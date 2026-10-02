const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `${nf0.format(cents / 100)} €`;
}

export function formatArea(m2: number | null | undefined): string {
  if (m2 == null) return "—";
  return `${nf1.format(m2)} m²`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  return nf0.format(n);
}

export function formatDate(epochSeconds: number | null | undefined): string {
  if (epochSeconds == null) return "—";
  return dateFmt.format(new Date(epochSeconds * 1000));
}

export function formatDateTime(epochSeconds: number | null | undefined): string {
  if (epochSeconds == null) return "—";
  return dateTimeFmt.format(new Date(epochSeconds * 1000));
}

/** Prix au m² calculé à partir du prix et de la surface habitable. */
export function pricePerM2(priceCents: number | null | undefined, habitableM2: number | null | undefined): number | null {
  if (priceCents == null || habitableM2 == null || habitableM2 <= 0) return null;
  const v = priceCents / 100 / habitableM2;
  return Math.round(v);
}

export function formatPricePerM2(priceCents: number | null | undefined, habitableM2: number | null | undefined): string {
  const v = pricePerM2(priceCents, habitableM2);
  return v == null ? "—" : `${nf0.format(v)} €`;
}

export function formatPpmBound(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${nf0.format(n)} €`;
}
