import Link from "next/link";
import { and, count, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { appSettings, db, listings, photos, rates } from "@/lib/db";
import { DEFAULT_CREDIT_SETTINGS, computePlan, type CreditSettings } from "@/lib/credit";
import { formatNumber, formatPrice, formatPricePerM2 } from "@/lib/format";
import { getPriceDrops, getRatingStats } from "@/lib/stats";
import { btnPrimaryCls, cardCls, StatTile, StarsDisplay, StatusPill, Thumb, type ListingStatus } from "@/components/ui";

const RECENT_COUNT = 6;

export default async function SummaryPage() {
  await requireUser();

  const [{ total }] = await db.select({ total: count() }).from(listings);
  const byStatus = await db
    .select({ status: listings.status, n: count() })
    .from(listings)
    .groupBy(listings.status);
  const nOnline = byStatus.find((s) => s.status === "online")?.n ?? 0;
  const nOffline = byStatus.find((s) => s.status === "offline")?.n ?? 0;
  const nUnknown = byStatus.find((s) => s.status === "unknown")?.n ?? 0;

  const drops = await getPriceDrops();
  const ratingStats = await getRatingStats();

  // Notes globales (moyenne sur toutes les annonces notées).
  const globalRating = ratingStats.size
    ? [...ratingStats.values()].reduce((acc, r) => acc + r.avg, 0) / ratingStats.size
    : null;
  const totalVotes = [...ratingStats.values()].reduce((acc, r) => acc + r.n, 0);

  // Crédit : paramètres communs + meilleur taux par durée.
  const settingsRow = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  const settings: CreditSettings = settingsRow
    ? {
        monthlyBudget: settingsRow.monthlyBudget,
        downPayment: settingsRow.downPayment,
        durationYears: settingsRow.durationYears,
      }
    : DEFAULT_CREDIT_SETTINGS;
  const rateRows = await db.select().from(rates);
  const bestByDuration = new Map<number, { bank: string; rate: number }>();
  for (const r of rateRows) {
    if (r.durationYears == null) continue;
    const cur = bestByDuration.get(r.durationYears);
    if (!cur || r.rate < cur.rate) bestByDuration.set(r.durationYears, { bank: r.bank, rate: r.rate });
  }
  const bestRates = [...bestByDuration.entries()]
    .map(([durationYears, v]) => ({ durationYears, ...v }))
    .sort((a, b) => a.durationYears - b.durationYears);
  const forDuration = rateRows.filter(
    (r) => r.durationYears == null || r.durationYears === settings.durationYears,
  );
  const bestForSettings = forDuration.length
    ? Math.min(...forDuration.map((r) => r.rate))
    : rateRows.length
      ? Math.min(...rateRows.map((r) => r.rate))
      : null;
  const plan = bestForSettings != null && settings.monthlyBudget > 0
    ? computePlan(settings, bestForSettings)
    : null;

  // Dernières annonces avec vignette.
  const recent = await db
    .select({
      id: listings.id,
      title: listings.title,
      city: listings.city,
      postalCode: listings.postalCode,
      priceCents: listings.priceCents,
      habitableM2: listings.habitableM2,
      status: listings.status,
      createdAt: listings.createdAt,
      thumb: photos.path,
    })
    .from(listings)
    .leftJoin(photos, and(eq(photos.listingId, listings.id), eq(photos.position, 0)))
    .orderBy(desc(listings.createdAt))
    .limit(RECENT_COUNT);

  const today = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date());

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Résumé</h1>
          <p className="mt-1 text-sm capitalize text-muted">{today}</p>
        </div>
        <Link href="/listings/new" className={btnPrimaryCls}>
          Ajouter une annonce
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Annonces suivies"
          value={formatNumber(total)}
          sub={`${nOnline} en ligne · ${nOffline} hors ligne${nUnknown ? ` · ${nUnknown} sans statut` : ""}`}
        />
        <StatTile label="Baisses de prix" value={formatNumber(drops.size)} sub="par rapport à la dernière vérification" />
        <StatTile
          label="Note moyenne"
          value={globalRating != null ? `${globalRating.toFixed(1)} / 5` : "—"}
          sub={totalVotes > 0 ? `${totalVotes} vote${totalVotes > 1 ? "s" : ""} au total` : "pas encore de vote"}
        />
        <StatTile
          label="Capacité d'emprunt"
          value={plan ? formatPrice(plan.capacity * 100) : "—"}
          sub={
            plan
              ? `budget avec apport : ${formatPrice(plan.budget * 100)} · ${formatPrice(plan.monthlyBudget * 100)} / mois sur ${settings.durationYears} ans à ${String(bestForSettings).replace(".", ",")} %`
              : settings.monthlyBudget > 0
                ? "aucun taux saisi — voir la page Crédit"
                : "règle ton budget mensuel dans la page Crédit"
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={cardCls}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight">Meilleurs taux du moment</h2>
            <Link href="/credit" className="text-xs text-accent underline-offset-4 hover:underline">
              Page crédit →
            </Link>
          </div>
          {bestRates.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">
              Aucun taux saisi. Ajoute-les dans la page Crédit pour calculer la capacité d’emprunt.
            </p>
          ) : (
            <ul>
              {bestRates.map((r) => (
                <li key={r.durationYears} className="flex items-center justify-between border-b border-line/60 px-5 py-3 last:border-0">
                  <span className="text-sm text-muted">
                    Sur {r.durationYears} ans · {r.bank}
                  </span>
                  <span className="font-mono text-sm font-semibold text-accent">
                    {String(r.rate).replace(".", ",")} %
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={cardCls}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold tracking-tight">Dernières annonces</h2>
            <Link href="/listings" className="text-xs text-accent underline-offset-4 hover:underline">
              Toutes les annonces →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Le carnet est vide — ajoute la première annonce.</p>
          ) : (
            <ul>
              {recent.map((r) => {
                const rating = ratingStats.get(r.id);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/listings/${r.id}`}
                      className="flex items-center gap-3 border-b border-line/60 px-5 py-3 transition-colors last:border-0 hover:bg-surface-2/60"
                    >
                      <Thumb path={r.thumb} title={r.title} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.title || "Sans titre"}</span>
                        <span className="block text-xs text-muted">
                          {r.postalCode} {r.city} · {formatPrice(r.priceCents)} ·{" "}
                          {formatPricePerM2(r.priceCents, r.habitableM2)} / m²
                        </span>
                      </span>
                      <StarsDisplay avg={rating?.avg ?? null} count={rating?.n} />
                      <StatusPill status={r.status as ListingStatus} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {drops.size > 0 ? (
        <p className="mt-4 text-xs text-muted">
          {drops.size} annonce{drops.size > 1 ? "s" : ""} avec une baisse de prix détectée — les écarts
          apparaissent dans la page Annonces.
        </p>
      ) : null}
    </div>
  );
}
