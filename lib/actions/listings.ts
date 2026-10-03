"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { db, listings, photos } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { parseIntInput, parseNumInput, parsePriceInput } from "@/lib/forms";
import { fetchListingHtml } from "@/lib/lbc/fetch";
import { parseListingHtml } from "@/lib/lbc/parse";
import { downloadPhotos, removeListingPhotos, saveUploadedPhotos } from "@/lib/lbc/photos";
import { checkListingNow, restrictionUntil } from "@/lib/status/checker";

const LBC_URL_RE = /^https:\/\/www\.leboncoin\.fr\/.+/;

export type ListingFormState =
  | { error?: string; fieldErrors?: Record<string, string>; ok?: boolean }
  | undefined;

function readListingFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  return {
    title,
    url,
    description: String(formData.get("description") ?? "").trim(),
    priceCents: parsePriceInput(formData.get("price")),
    habitableM2: parseNumInput(formData.get("habitable_m2")),
    gardenM2: parseNumInput(formData.get("garden_m2")),
    rooms: parseIntInput(formData.get("rooms")),
    city: String(formData.get("city") ?? "").trim(),
    postalCode: String(formData.get("postal_code") ?? "").trim(),
    pricePerM2Min: parseNumInput(formData.get("ppm_min")),
    pricePerM2Max: parseNumInput(formData.get("ppm_max")),
    labelId: Number(formData.get("label_id")) || null,
  };
}

function validateListingFields(fields: ReturnType<typeof readListingFields>) {
  const fieldErrors: Record<string, string> = {};
  if (!fields.title) fieldErrors.title = "Le titre est requis.";
  if (fields.url && !LBC_URL_RE.test(fields.url)) {
    fieldErrors.url = "URL Leboncoin invalide (laisser vide si l'annonce n'est pas sur Leboncoin).";
  }
  return fieldErrors;
}

// ---- ajout -----------------------------------------------------------------

export async function addListingFromUrlAction(
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireUser();
  const url = String(formData.get("url") ?? "").trim();
  if (!LBC_URL_RE.test(url)) {
    return { error: "Colle une URL d'annonce Leboncoin valide (https://www.leboncoin.fr/…)." };
  }
  const existing = await db.select({ id: listings.id }).from(listings).where(eq(listings.url, url));
  if (existing.length) {
    return { error: `Cette annonce est déjà suivie (n° ${existing[0].id}).` };
  }
  // Pendant une restriction Leboncoin, ne pas lancer de navigateur : aucune requête.
  const restricted = await restrictionUntil();
  if (restricted != null) {
    return {
      error: `Leboncoin restreint temporairement l'accès (protection anti-bot). Réessaie après le ${formatDateTime(restricted)} — ou utilise la saisie manuelle ci-dessous.`,
    };
  }
  let parsed;
  try {
    // Fenêtre visible : l'utilisateur est devant son navigateur et peut résoudre un
    // captcha si Leboncoin en demande un.
    const page = await fetchListingHtml(url, { headed: true });
    if (page.challenged || page.status === 403 || page.status === 429) {
      return {
        error:
          "Leboncoin demande une vérification anti-bot. Réessaie dans quelques minutes — ou utilise la saisie manuelle ci-dessous.",
      };
    }
    parsed = parseListingHtml(page.html);
  } catch (err) {
    // On journalise la cause réelle (Chromium absent, timeout réseau…) dans les logs
    // du serveur : le message renvoyé à l'utilisateur reste volontairement générique.
    console.error("[add-listing] échec de la récupération Leboncoin :", err);
    return {
      error: "Impossible de joindre Leboncoin (réseau ou protection anti-bot). Réessaie plus tard ou utilise la saisie manuelle.",
    };
  }
  if (!parsed.title && parsed.priceCents == null && parsed.imageUrls.length === 0) {
    return {
      error: "Impossible d'analyser la page (structure changée ou protection anti-bot). Utilise la saisie manuelle ci-dessous.",
    };
  }
  const [listing] = await db
    .insert(listings)
    .values({
      url,
      source: "url",
      title: parsed.title,
      description: parsed.description,
      priceCents: parsed.priceCents,
      habitableM2: parsed.habitableM2,
      gardenM2: parsed.gardenM2,
      rooms: parsed.rooms,
      city: parsed.city,
      postalCode: parsed.postalCode,
      status: "online",
      createdById: user.id,
      lastCheckedAt: Math.floor(Date.now() / 1000),
    })
    .returning({ id: listings.id });
  const saved = await downloadPhotos(parsed.imageUrls, listing.id);
  if (saved.length) {
    await db
      .insert(photos)
      .values(saved.map((p, i) => ({ listingId: listing.id, path: p, position: i })));
  }
  redirect(`/listings/${listing.id}`);
}

export async function addListingManualAction(
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  const user = await requireUser();
  const fields = readListingFields(formData);
  const fieldErrors = validateListingFields(fields);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (fields.url) {
    const existing = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.url, fields.url));
    if (existing.length) return { error: `Cette URL est déjà suivie (n° ${existing[0].id}).` };
  }
  const [listing] = await db
    .insert(listings)
    .values({
      url: fields.url || null,
      source: "manual",
      title: fields.title,
      description: fields.description,
      priceCents: fields.priceCents,
      habitableM2: fields.habitableM2,
      gardenM2: fields.gardenM2,
      rooms: fields.rooms,
      city: fields.city,
      postalCode: fields.postalCode,
      pricePerM2Min: fields.pricePerM2Min,
      pricePerM2Max: fields.pricePerM2Max,
      labelId: fields.labelId,
      status: "unknown",
      createdById: user.id,
    })
    .returning({ id: listings.id });
  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const saved = await saveUploadedPhotos(files, listing.id);
  if (saved.length) {
    await db
      .insert(photos)
      .values(saved.map((p, i) => ({ listingId: listing.id, path: p, position: i })));
  }
  redirect(`/listings/${listing.id}`);
}

// ---- mise à jour -----------------------------------------------------------

export async function updateListingAction(
  _prev: ListingFormState,
  formData: FormData,
): Promise<ListingFormState> {
  await requireUser();
  const listingId = Number(formData.get("listing_id"));
  const fields = readListingFields(formData);
  const fieldErrors = validateListingFields(fields);
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  await db
    .update(listings)
    .set({
      title: fields.title,
      url: fields.url || null,
      description: fields.description,
      priceCents: fields.priceCents,
      habitableM2: fields.habitableM2,
      gardenM2: fields.gardenM2,
      rooms: fields.rooms,
      city: fields.city,
      postalCode: fields.postalCode,
      pricePerM2Min: fields.pricePerM2Min,
      pricePerM2Max: fields.pricePerM2Max,
      labelId: fields.labelId,
    })
    .where(eq(listings.id, listingId));
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  revalidatePath("/");
  return { ok: true };
}

export async function setListingLabelAction(formData: FormData): Promise<void> {
  await requireUser();
  const listingId = Number(formData.get("listing_id"));
  const labelId = Number(formData.get("label_id")) || null;
  await db.update(listings).set({ labelId }).where(eq(listings.id, listingId));
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  revalidatePath("/");
}

export async function checkListingNowAction(formData: FormData): Promise<void> {
  await requireUser();
  const listingId = Number(formData.get("listing_id"));
  await checkListingNow(listingId, { headed: true });
  revalidatePath(`/listings/${listingId}`);
  revalidatePath("/listings");
  revalidatePath("/");
  redirect(`/listings/${listingId}`);
}

export async function deleteListingAction(formData: FormData): Promise<void> {
  await requireUser();
  const listingId = Number(formData.get("listing_id"));
  // Les lignes liées (photos, contrôles, commentaires, votes) partent en cascade,
  // il reste à retirer les fichiers photo du disque.
  await db.delete(listings).where(eq(listings.id, listingId));
  await removeListingPhotos(listingId);
  revalidatePath("/listings");
  revalidatePath("/");
  redirect("/listings");
}
