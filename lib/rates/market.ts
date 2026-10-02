// Taux officiel du marché : série mensuelle « crédits nouveaux à l'habitat à taux fixe »
// de la Banque de France (dispositif MIR), republiée en CSV sous Licence Ouverte.
const MARKET_CSV_URL = "https://eco3min.fr/dataset/fr/fr-mortgage-rate-new.csv";
export const MARKET_SOURCE_URL = "https://eco3min.fr/taux-credit-immobilier-france-dataset/";

export type MarketRate = { date: string; rate: number; recordedAt: number };

/** Série complète (mensuelle) du CSV, la plus récente en dernier. */
export async function fetchMarketSeries(): Promise<MarketRate[]> {
  const res = await fetch(MARKET_CSV_URL, {
    headers: { "user-agent": "monitor-real-estates/1.0 (usage privé)" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("date"));
  const series: MarketRate[] = [];
  for (const line of lines) {
    const [date, rateStr] = line.split(",");
    const rate = Number.parseFloat(rateStr);
    if (!date || !Number.isFinite(rate) || rate <= 0 || rate > 20) continue;
    // Le CSV donne le premier jour du mois, en UTC.
    series.push({ date, rate, recordedAt: Math.floor(new Date(date).getTime() / 1000) });
  }
  if (!series.length) throw new Error("CSV vide");
  return series;
}

export async function fetchMarketRate(): Promise<{ date: string; rate: number }> {
  const series = await fetchMarketSeries();
  const last = series[series.length - 1];
  return { date: last.date, rate: last.rate };
}
