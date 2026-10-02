import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { db, labels, listings } from "@/lib/db";
import { checkListingNowAction } from "@/lib/actions/listings";
import { restrictionUntil } from "@/lib/status/checker";
import {
  formatArea,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPpmBound,
  formatPrice,
  formatPricePerM2,
} from "@/lib/format";
import { btnGhostCls, cardCls, StatusPill, type ListingStatus } from "@/components/ui";
import { CommentForm } from "@/components/comment-form";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { EditListingForm } from "@/components/edit-listing-form";
import { Gallery } from "@/components/gallery";
import { LabelSelectForm } from "@/components/label-select-form";
import { RatingStars } from "@/components/rating-stars";

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const listingId = Number(id);
  if (!Number.isInteger(listingId)) notFound();

  const listing = await db.query.listings.findFirst({
    where: eq(listings.id, listingId),
    with: {
      label: true,
      createdBy: { columns: { id: true, username: true } },
      photos: true,
      comments: { with: { user: { columns: { id: true, username: true } } } },
      checks: true,
      ratings: true,
    },
  });
  if (!listing) notFound();

  const allLabels = await db.select({ id: labels.id, name: labels.name }).from(labels);
  const restricted = await restrictionUntil();
  const sortedPhotos = [...listing.photos].sort((a, b) => a.position - b.position);
  const sortedChecks = [...listing.checks].sort((a, b) => b.checkedAt - a.checkedAt);
  const conclusiveChecks = sortedChecks.filter((c) => c.conclusive && c.priceCents != null);
  const latestPrice = conclusiveChecks[0]?.priceCents ?? null;
  const previousPrice = conclusiveChecks[1]?.priceCents ?? null;
  const dropCents =
    previousPrice != null && latestPrice != null && previousPrice > latestPrice
      ? previousPrice - latestPrice
      : null;

  const avgRating =
    listing.ratings.length > 0
      ? listing.ratings.reduce((acc, r) => acc + r.stars, 0) / listing.ratings.length
      : null;
  const myRating = listing.ratings.find((r) => r.userId === user.id)?.stars ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/listings" className="text-sm text-muted hover:text-ink">
          ← Annonces
        </Link>
        <div className="flex items-center gap-4">
          {listing.url ? (
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Voir sur Leboncoin
            </a>
          ) : null}
          {listing.url ? (
            <form action={checkListingNowAction}>
              <input type="hidden" name="listing_id" value={listing.id} />
              <button type="submit" className={`${btnGhostCls} px-3 py-1.5`}>
                Vérifier maintenant
              </button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{listing.title || "Sans titre"}</h1>
        <StatusPill status={listing.status as ListingStatus} />
      </div>
      <p className="mt-1 text-sm text-muted">
        {listing.postalCode} {listing.city} · ajoutée par {listing.createdBy?.username} le{" "}
        {formatDate(listing.createdAt)}
        {listing.lastCheckedAt ? ` · vérifiée le ${formatDate(listing.lastCheckedAt)}` : ""}
      </p>

      {restricted != null ? (
        <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
          Leboncoin restreint temporairement l’accès (protection anti-bot) : aucune vérification
          automatique jusqu’au {formatDateTime(restricted)}. La saisie et l’édition manuelles
          restent disponibles.
        </p>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <Gallery photos={sortedPhotos} />

          {listing.description ? (
            <section>
              <h2 className="text-sm font-semibold tracking-tight">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/90">
                {listing.description}
              </p>
            </section>
          ) : null}

          <section>
            <h2 className="text-sm font-semibold tracking-tight">Historique des vérifications</h2>
            {sortedChecks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                Pas encore de point de contrôle. La première vérification périodique viendra toute
                seule, ou clique « Vérifier maintenant ».
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-xl border border-line bg-surface">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-muted">
                      <th className="py-2 pl-4 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Statut</th>
                      <th className="py-2 pr-3 text-right font-medium">Prix constaté</th>
                      <th className="py-2 pr-4 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedChecks.map((c) => (
                      <tr key={c.id} className="border-b border-line/60 last:border-0">
                        <td className="py-2 pl-4 pr-3 whitespace-nowrap">{formatDateTime(c.checkedAt)}</td>
                        <td className="py-2 pr-3">
                          {c.online ? (
                            <span className="text-accent">en ligne</span>
                          ) : c.conclusive ? (
                            <span className="text-offline">hors ligne</span>
                          ) : (
                            <span className="text-muted">indéterminé</span>
                          )}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-right font-mono">
                          {formatPrice(c.priceCents)}
                        </td>
                        <td className="py-2 pr-4 text-muted">{c.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold tracking-tight">Discussion</h2>
            <div className="mt-3 space-y-3">
              {listing.comments.length === 0 ? (
                <p className="text-sm text-muted">Aucun message pour l’instant.</p>
              ) : (
                listing.comments.map((c) => (
                  <div key={c.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                    <p className="text-xs text-muted">
                      {c.user?.username} · {formatDateTime(c.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm">{c.body}</p>
                  </div>
                ))
              )}
              <div className="rounded-lg border border-line bg-surface p-4">
                <CommentForm listingId={listing.id} />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <RatingStars
            listingId={listing.id}
            myStars={myRating}
            avg={avgRating}
            count={listing.ratings.length}
          />

          <div className={`${cardCls} px-4 py-4`}>
            <h2 className="text-sm font-semibold tracking-tight">La fiche</h2>
            <dl className="mt-2">
              <FicheRow label="Prix">
                <span className="font-mono font-semibold">{formatPrice(listing.priceCents)}</span>
                {dropCents ? (
                  <span className="ml-2 font-mono text-xs text-offline">−{formatPrice(dropCents)}</span>
                ) : null}
              </FicheRow>
              <FicheRow label="Surface habitable">{formatArea(listing.habitableM2)}</FicheRow>
              <FicheRow label="Jardin">{formatArea(listing.gardenM2)}</FicheRow>
              <FicheRow label="Pièces">{formatNumber(listing.rooms)}</FicheRow>
              <FicheRow label="Ville">
                {listing.postalCode} {listing.city}
              </FicheRow>
              <FicheRow label="€ / m²" mono>
                {formatPricePerM2(listing.priceCents, listing.habitableM2)}
              </FicheRow>
              <FicheRow label="Fourchette">
                {formatPpmBound(listing.pricePerM2Min)}–{formatPpmBound(listing.pricePerM2Max)}
              </FicheRow>
              <FicheRow label="Étiquette">
                <LabelSelectForm listingId={listing.id} current={listing.labelId} labels={allLabels} />
              </FicheRow>
              <FicheRow label="Dernière vérification">
                {listing.lastCheckedAt ? formatDateTime(listing.lastCheckedAt) : "—"}
              </FicheRow>
            </dl>
            <details className="mt-4 rounded-lg border border-line">
              <summary className="cursor-pointer px-4 py-2 text-sm text-muted transition-colors hover:text-ink">
                Modifier la fiche
              </summary>
              <div className="border-t border-line p-4">
                <EditListingForm
                  listingId={listing.id}
                  values={{
                    title: listing.title,
                    url: listing.url ?? "",
                    price: listing.priceCents != null ? String(listing.priceCents / 100) : "",
                    habitable_m2: listing.habitableM2 != null ? String(listing.habitableM2) : "",
                    garden_m2: listing.gardenM2 != null ? String(listing.gardenM2) : "",
                    rooms: listing.rooms != null ? String(listing.rooms) : "",
                    city: listing.city,
                    postal_code: listing.postalCode,
                    ppm_min: listing.pricePerM2Min != null ? String(listing.pricePerM2Min) : "",
                    ppm_max: listing.pricePerM2Max != null ? String(listing.pricePerM2Max) : "",
                    description: listing.description,
                    label_id: listing.labelId != null ? String(listing.labelId) : "",
                  }}
                  labels={allLabels}
                />
              </div>
            </details>
          </div>

          <DeleteListingButton id={listing.id} title={listing.title} />
        </aside>
      </div>
    </div>
  );
}

function FicheRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/60 py-2 last:border-0">
      <dt className="shrink-0 text-sm text-muted">{label}</dt>
      <dd className={mono ? "text-right font-mono text-sm" : "text-right text-sm"}>{children}</dd>
    </div>
  );
}
