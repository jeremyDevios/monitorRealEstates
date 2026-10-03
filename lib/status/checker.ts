import { and, eq, isNotNull, isNull, lt, or } from "drizzle-orm";
import { appSettings, db, listingChecks, listings } from "@/lib/db";
import { fetchListingHtml } from "@/lib/lbc/fetch";
import { parseListingHtml } from "@/lib/lbc/parse";
import { formatDateTime } from "@/lib/format";

const MIN_CHECK_AGE_SECONDS = 3600; // au moins 1 h entre deux contrôles d'une même annonce

// Marqueurs présents sur la page d'une annonce retirée (qui renvoie souvent un HTTP 200).
const OFFLINE_MARKERS = [
  "annonce désactivée",
  "cette annonce n'est plus",
  "n'existe plus",
  "annonce introuvable",
  "annonce supprimée",
  "annonce expirée",
];

// Page « Accès temporairement restreint » : Leboncoin a banni notre accès
// (protection anti-bot). On ne retente pas avant la fin de la restriction.
const RESTRICTION_MARKERS = ["accès temporairement restreint", "accès restreint"];

/**
 * Retire le contenu des balises <script> : Leboncoin inline un dictionnaire i18n
 * contenant les textes des pages d'erreur (« Annonce introuvable », « annonce
 * supprimée »…), qui matchent les marqueurs sur TOUTES les pages, y compris en ligne.
 * Les marqueurs ne doivent être cherchés que dans le contenu rendu.
 */
function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

export type CheckOutcome = {
  conclusive: boolean;
  online: boolean;
  priceCents: number | null;
  restricted?: boolean;
  challenged?: boolean;
  note?: string;
};

// ---- restriction d'accès (cooldown) ----------------------------------------

/** Fin de restriction si elle est en cours, sinon null. */
export async function restrictionUntil(): Promise<number | null> {
  const settings = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  const until = settings?.lbcRestrictedUntil ?? null;
  if (until == null) return null;
  return until > Math.floor(Date.now() / 1000) ? until : null;
}

/** Pose une restriction (12 h, escalade à 24 h si on a forcé pendant une restriction). */
export async function setRestriction(): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const settings = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  const previous = settings?.lbcRestrictedUntil ?? null;
  const cooldown = previous != null && previous > now ? 24 * 3600 : 12 * 3600;
  const until = now + cooldown;
  await db
    .insert(appSettings)
    .values({ id: 1, lbcRestrictedUntil: until })
    .onConflictDoUpdate({ target: appSettings.id, set: { lbcRestrictedUntil: until } });
  return until;
}

/** Une vérification réussie lève la restriction. */
export async function clearRestriction(): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: 1, lbcRestrictedUntil: null })
    .onConflictDoUpdate({ target: appSettings.id, set: { lbcRestrictedUntil: null } });
}

export async function checkListingUrl(url: string, opts?: { headed?: boolean }): Promise<CheckOutcome> {
  let page;
  try {
    page = await fetchListingHtml(url, opts);
  } catch (err) {
    return {
      conclusive: false,
      online: false,
      priceCents: null,
      note: `erreur réseau : ${err instanceof Error ? err.message : "inconnue"}`,
    };
  }
  const { html, finalUrl, status, challenged } = page;
  const lower = stripScripts(html).toLowerCase();
  // Bannissement « Accès temporairement restreint » : signalé à l'appelant qui pose le cooldown.
  if (RESTRICTION_MARKERS.some((m) => lower.includes(m))) {
    return {
      conclusive: false,
      online: false,
      priceCents: null,
      restricted: true,
      note: "accès temporairement restreint par Leboncoin",
    };
  }
  // Défi anti-bot ou erreur serveur : non concluant, ne jamais marquer « hors ligne » à tort.
  if (challenged) {
    return {
      conclusive: false,
      online: false,
      priceCents: null,
      challenged: true,
      note: "défi anti-bot (DataDome) — non concluant",
    };
  }
  if (status === 403 || status === 429 || (status != null && status >= 500)) {
    return { conclusive: false, online: false, priceCents: null, note: `HTTP ${status} — non concluant` };
  }
  if (!finalUrl.startsWith("https://www.leboncoin.fr/")) {
    return { conclusive: true, online: false, priceCents: null, note: "redirigée hors de la page annonce" };
  }
  if (status === 404 || status === 410) {
    return { conclusive: true, online: false, priceCents: null, note: `HTTP ${status}` };
  }
  const marker = OFFLINE_MARKERS.find((m) => lower.includes(m));
  if (marker) {
    return { conclusive: true, online: false, priceCents: null, note: "marqueur d'annonce retirée" };
  }
  const parsed = parseListingHtml(html);
  return { conclusive: true, online: true, priceCents: parsed.priceCents };
}

/** Vérifie une annonce précise (bouton « Vérifier maintenant »). */
export async function checkListingNow(listingId: number, opts?: { headed?: boolean }): Promise<boolean> {
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, listingId) });
  if (!listing?.url) return false;
  const restricted = await restrictionUntil();
  if (restricted != null) {
    // Aucune requête pendant la restriction : on note la vérification différée.
    await db.insert(listingChecks).values({
      listingId: listing.id,
      online: false,
      conclusive: false,
      priceCents: null,
      note: `vérification différée : accès restreint par Leboncoin jusqu'au ${formatDateTime(restricted)}`,
    });
    return false;
  }
  const outcome = await checkListingUrl(listing.url, opts);
  const now = Math.floor(Date.now() / 1000);
  await db.insert(listingChecks).values({
    listingId: listing.id,
    online: outcome.online,
    conclusive: outcome.conclusive,
    priceCents: outcome.priceCents,
    note: outcome.note,
  });
  if (outcome.restricted || outcome.challenged) {
    await setRestriction();
    return false;
  }
  await db
    .update(listings)
    .set({
      lastCheckedAt: now,
      ...(outcome.conclusive ? { status: outcome.online ? "online" : "offline" } : {}),
    })
    .where(eq(listings.id, listing.id));
  if (outcome.conclusive && outcome.online) await clearRestriction();
  return true;
}

export type CheckPassSummary = { checked: number; conclusive: number; inconclusive: number };

/**
 * Passe complète de vérification : toutes les annonces avec URL dues depuis plus d'une heure,
 * avec une pause entre deux requêtes (CHECK_DELAY_MS, 4 s par défaut).
 * Utilisé par `npm run check-listings` et par le cron d'instrumentation.
 */
export async function runCheckPass(): Promise<CheckPassSummary> {
  const restricted = await restrictionUntil();
  if (restricted != null) {
    console.log(
      `[check-listings] passe annulée : accès restreint par Leboncoin jusqu'au ${formatDateTime(restricted)}`,
    );
    return { checked: 0, conclusive: 0, inconclusive: 0 };
  }
  const now = Math.floor(Date.now() / 1000);
  const due = await db
    .select()
    .from(listings)
    .where(
      and(
        isNotNull(listings.url),
        or(isNull(listings.lastCheckedAt), lt(listings.lastCheckedAt, now - MIN_CHECK_AGE_SECONDS)),
      ),
    );
  console.log(`[check-listings] ${due.length} annonce(s) à vérifier`);

  const delayMs = Math.max(0, Number(process.env.CHECK_DELAY_MS ?? 4000));
  let conclusive = 0;
  let inconclusive = 0;
  for (const [i, listing] of due.entries()) {
    const outcome = await checkListingUrl(listing.url!);
    await db.insert(listingChecks).values({
      listingId: listing.id,
      online: outcome.online,
      conclusive: outcome.conclusive,
      priceCents: outcome.priceCents,
      note: outcome.note,
    });
    if (outcome.restricted || outcome.challenged) {
      // Restriction ou défi : on pose le cooldown et on arrête la passe immédiatement.
      await setRestriction();
      inconclusive++;
      break;
    }
    await db
      .update(listings)
      .set({
        lastCheckedAt: now,
        ...(outcome.conclusive ? { status: outcome.online ? "online" : "offline" } : {}),
      })
      .where(eq(listings.id, listing.id));
    if (outcome.conclusive) conclusive++;
    else inconclusive++;
    if (i < due.length - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  const summary = { checked: conclusive + inconclusive, conclusive, inconclusive };
  console.log(
    `[check-listings] terminé : ${summary.checked} vérifiée(s), ${summary.conclusive} concluante(s), ${summary.inconclusive} non concluante(s)`,
  );
  return summary;
}
