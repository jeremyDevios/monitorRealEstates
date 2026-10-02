import Link from "next/link";
import { and, asc, count, desc, eq, like, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db, labels, listings, photos, ratings, users } from "@/lib/db";
import {
  formatArea,
  formatDate,
  formatNumber,
  formatPpmBound,
  formatPrice,
  formatPricePerM2,
} from "@/lib/format";
import { getPriceDrops } from "@/lib/stats";
import {
  btnPrimaryCls,
  inputCls,
  LabelChip,
  PriceDrop,
  StarsDisplay,
  StatusPill,
  Thumb,
  type ListingStatus,
} from "@/components/ui";

const PAGE_SIZE = 50;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = await searchParams;
  const statut = typeof sp.statut === "string" ? sp.statut : "";
  const etiquette = Number(sp.etiquette) || null;
  const ville = typeof sp.ville === "string" ? sp.ville.trim() : "";
  const par = Number(sp.par) || null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "recent";
  const page = Math.max(1, Number(sp.page) || 1);

  const cond = [];
  if (statut === "online" || statut === "offline" || statut === "unknown") {
    cond.push(eq(listings.status, statut));
  }
  if (etiquette) cond.push(eq(listings.labelId, etiquette));
  if (par) cond.push(eq(listings.createdById, par));
  if (ville) cond.push(like(listings.city, `%${ville}%`));
  if (q) cond.push(like(listings.title, `%${q}%`));
  const where = cond.length ? and(...cond) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(listings).where(where);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  // Note moyenne par annonce (sous-requête agrégée, utilisée pour l'affichage et le tri).
  const avgStars = db
    .select({
      listingId: ratings.listingId,
      avg: sql<number>`avg(${ratings.stars})`.as("avg"),
      n: sql<number>`count(*)`.as("n"),
    })
    .from(ratings)
    .groupBy(ratings.listingId)
    .as("avg_stars");

  const order =
    sort === "price_asc"
      ? [asc(sql`${listings.priceCents} IS NULL`), asc(listings.priceCents)]
      : sort === "price_desc"
        ? [asc(sql`${listings.priceCents} IS NULL`), desc(listings.priceCents)]
        : sort === "surface_desc"
          ? [desc(sql`${listings.habitableM2} IS NULL`), desc(listings.habitableM2)]
          : sort === "rating_desc"
            ? [asc(sql`${avgStars.avg} IS NULL`), desc(avgStars.avg)]
            : [desc(listings.createdAt)];

  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      city: listings.city,
      postalCode: listings.postalCode,
      priceCents: listings.priceCents,
      habitableM2: listings.habitableM2,
      gardenM2: listings.gardenM2,
      rooms: listings.rooms,
      status: listings.status,
      createdAt: listings.createdAt,
      pricePerM2Min: listings.pricePerM2Min,
      pricePerM2Max: listings.pricePerM2Max,
      labelName: labels.name,
      labelColor: labels.color,
      creator: users.username,
      thumb: photos.path,
      avgRating: avgStars.avg,
      nRatings: avgStars.n,
    })
    .from(listings)
    .leftJoin(labels, eq(listings.labelId, labels.id))
    .leftJoin(users, eq(listings.createdById, users.id))
    .leftJoin(photos, and(eq(photos.listingId, listings.id), eq(photos.position, 0)))
    .leftJoin(avgStars, eq(avgStars.listingId, listings.id))
    .where(where)
    .orderBy(...order)
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  const drops = await getPriceDrops();

  const allLabels = await db.select().from(labels);
  const allUsers = await db.select({ id: users.id, username: users.username }).from(users);

  const qs = (overrides: Record<string, string | number | null | undefined> = {}) => {
    const base: Record<string, string> = { sort };
    if (statut) base.statut = statut;
    if (etiquette) base.etiquette = String(etiquette);
    if (ville) base.ville = ville;
    if (par) base.par = String(par);
    if (q) base.q = q;
    for (const [k, v] of Object.entries(overrides)) {
      if (v == null || v === "") delete base[k];
      else base[k] = String(v);
    }
    const p = new URLSearchParams(base);
    return p.toString() ? `?${p.toString()}` : "";
  };

  const plural = (n: number) => (n > 1 ? "s" : "");

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Annonces</h1>
          <p className="mt-1 text-sm text-muted">
            {formatNumber(total)} annonce{plural(total)} · {drops.size} baisse{drops.size > 1 ? "s" : ""} de prix
            détectée{drops.size > 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/listings/new" className={btnPrimaryCls}>
          Ajouter une annonce
        </Link>
      </div>

      <form method="GET" action="/listings" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <input type="hidden" name="sort" value={sort} />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Statut</span>
          <select name="statut" defaultValue={statut} className={inputCls}>
            <option value="">Tous</option>
            <option value="online">En ligne</option>
            <option value="offline">Hors ligne</option>
            <option value="unknown">Sans statut</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Étiquette</span>
          <select name="etiquette" defaultValue={etiquette ?? ""} className={inputCls}>
            <option value="">Toutes</option>
            {allLabels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Enregistrée par</span>
          <select name="par" defaultValue={par ?? ""} className={inputCls}>
            <option value="">Tous</option>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Ville</span>
          <input name="ville" defaultValue={ville} placeholder="Ex. Poitiers" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Titre</span>
          <input name="q" defaultValue={q} placeholder="Recherche…" className={inputCls} />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:border-accent/50 hover:text-accent"
        >
          Filtrer
        </button>
        {(statut || etiquette || ville || par || q) && (
          <Link
            href="/listings"
            className="px-2 py-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-sm text-muted">
            {total === 0 ? "Le carnet est vide pour l'instant." : "Aucune annonce ne correspond à ces filtres."}
          </p>
          {total === 0 ? (
            <Link
              href="/listings/new"
              className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline"
            >
              Ajouter la première annonce
            </Link>
          ) : (
            <Link href="/listings" className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline">
              Réinitialiser les filtres
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-3 pl-4 pr-3 font-medium">Annonce</th>
                  <th className="py-3 pr-3 text-right font-medium">
                    <Link
                      href={`/listings${qs({ sort: sort === "price_desc" ? "recent" : "price_desc" })}`}
                      className="hover:text-ink hover:underline"
                      title="Trier par prix"
                    >
                      Prix {sort === "price_desc" ? "↓" : sort === "price_asc" ? "↑" : "↕"}
                    </Link>
                  </th>
                  <th className="py-3 pr-3 text-right font-medium">
                    <Link
                      href={`/listings${qs({ sort: sort === "surface_desc" ? "recent" : "surface_desc" })}`}
                      className="hover:text-ink hover:underline"
                      title="Trier par surface"
                    >
                      Surf. hab.
                    </Link>
                  </th>
                  <th className="py-3 pr-3 text-right font-medium">Jardin</th>
                  <th className="py-3 pr-3 text-right font-medium">Pièces</th>
                  <th className="py-3 pr-3 text-right font-medium">€ / m²</th>
                  <th className="py-3 pr-3 font-medium">
                    <Link
                      href={`/listings${qs({ sort: sort === "rating_desc" ? "recent" : "rating_desc" })}`}
                      className="hover:text-ink hover:underline"
                      title="Trier par note"
                    >
                      Note {sort === "rating_desc" ? "↓" : "↕"}
                    </Link>
                  </th>
                  <th className="py-3 pr-3 font-medium">Statut</th>
                  <th className="py-3 pr-3 font-medium">Étiquette</th>
                  <th className="py-3 pr-3 font-medium">Par</th>
                  <th className="py-3 pr-4 font-medium">Ajoutée</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 align-top transition-colors last:border-0 hover:bg-surface-2/50">
                    <td className="py-3 pl-4 pr-3">
                      <div className="flex items-center gap-3">
                        <Thumb path={r.thumb} title={r.title} />
                        <div className="min-w-0">
                          <Link
                            href={`/listings/${r.id}`}
                            className="block max-w-[260px] truncate font-medium hover:text-accent hover:underline underline-offset-4"
                          >
                            {r.title || "Sans titre"}
                          </Link>
                          <div className="text-xs text-muted">
                            {r.postalCode} {r.city}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-right font-mono">
                      {formatPrice(r.priceCents)}
                      {drops.get(r.id) ? <PriceDrop deltaCents={drops.get(r.id)!} /> : null}
                    </td>
                    <td className="py-3 pr-3 whitespace-nowrap text-right">{formatArea(r.habitableM2)}</td>
                    <td className="py-3 pr-3 whitespace-nowrap text-right">{formatArea(r.gardenM2)}</td>
                    <td className="py-3 pr-3 text-right">{formatNumber(r.rooms)}</td>
                    <td className="py-3 pr-3 whitespace-nowrap text-right font-mono">
                      {formatPricePerM2(r.priceCents, r.habitableM2)}
                      {r.pricePerM2Min != null || r.pricePerM2Max != null ? (
                        <div className="text-xs text-muted">
                          {formatPpmBound(r.pricePerM2Min)}–{formatPpmBound(r.pricePerM2Max)}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3">
                      <StarsDisplay avg={r.avgRating} count={r.nRatings} />
                    </td>
                    <td className="py-3 pr-3">
                      <StatusPill status={r.status as ListingStatus} />
                    </td>
                    <td className="py-3 pr-3">
                      {r.labelName ? (
                        <LabelChip name={r.labelName} color={r.labelColor ?? "#666666"} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-muted">{r.creator}</td>
                    <td className="py-3 pr-4 whitespace-nowrap text-muted">{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>
              Page {safePage} / {totalPages}
            </span>
            <span className="flex gap-4">
              {safePage > 1 ? (
                <Link href={`/listings${qs({ page: safePage - 1 })}`} className="hover:text-ink hover:underline">
                  ← précédent
                </Link>
              ) : (
                <span className="opacity-50">← précédent</span>
              )}
              {safePage < totalPages ? (
                <Link href={`/listings${qs({ page: safePage + 1 })}`} className="hover:text-ink hover:underline">
                  suivant →
                </Link>
              ) : (
                <span className="opacity-50">suivant →</span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
