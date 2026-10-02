/** Parseurs de champs de formulaire (partagés par les actions serveur). */

export function parsePriceInput(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().replace(/[\s  €]/g, "").replace(",", ".");
  const m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return Math.round(Number.parseFloat(m[1]) * 100);
}

export function parseNumInput(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number.parseFloat(v.trim().replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseIntInput(v: unknown): number | null {
  const n = parseNumInput(v);
  return n == null ? null : Math.round(n);
}
