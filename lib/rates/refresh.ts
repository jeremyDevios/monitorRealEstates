import { and, asc, eq, gte, lt } from "drizzle-orm";
import { appSettings, db, rateHistory, rates } from "@/lib/db";
import { MARKET_SOURCE } from "@/lib/credit";
import { fetchBankRates } from "./banks";
import { fetchMarketRate, fetchMarketSeries, MARKET_SOURCE_URL } from "./market";

const WEB_SOURCE = "web";

export type RefreshResult =
  | {
      fetched: true;
      rate: number;
      date: string;
      banks: number;
      banksError?: string;
    }
  | { fetched: false; reason: "already-today" | "error"; error?: string };

/**
 * Met à jour le taux du marché (Banque de France) et le baromètre des banques
 * (MoneyVox) dans la base. Au plus une fois par jour, sauf `force` (bouton manuel).
 * En cas d'échec d'une source, les lignes précédentes de cette source sont conservées.
 */
export async function refreshMarketRates({ force = false }: { force?: boolean } = {}): Promise<RefreshResult> {
  const settings = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  const lastFetch = settings?.ratesFetchedAt ?? null;
  if (!force && lastFetch != null) {
    const last = new Date(lastFetch * 1000);
    const now = new Date();
    if (last.toDateString() === now.toDateString()) {
      return { fetched: false, reason: "already-today" };
    }
  }

  // Taux du marché.
  let marketRate: number;
  let marketDate: string;
  try {
    const market = await fetchMarketRate();
    await db.delete(rates).where(eq(rates.source, MARKET_SOURCE));
    await db.insert(rates).values({
      bank: "Marché (Banque de France)",
      rate: market.rate,
      durationYears: null,
      source: MARKET_SOURCE,
      sourceUrl: MARKET_SOURCE_URL,
    });
    marketRate = market.rate;
    marketDate = market.date;
  } catch (err) {
    return {
      fetched: false,
      reason: "error",
      error: err instanceof Error ? err.message : "erreur inconnue",
    };
  }

  // Baromètre des banques (indépendant du taux marché : un échec ne bloque pas le reste).
  let banks = 0;
  let banksError: string | undefined;
  try {
    const bankRates = await fetchBankRates();
    await db.delete(rates).where(eq(rates.source, WEB_SOURCE));
    await db
      .insert(rates)
      .values(
        bankRates.map((b) => ({
          bank: b.bank,
          rate: b.rate,
          durationYears: b.durationYears,
          source: WEB_SOURCE,
          sourceUrl: b.sourceUrl,
        })),
      );
    banks = bankRates.length;
  } catch (err) {
    banksError = err instanceof Error ? err.message : "erreur inconnue";
  }

  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(appSettings)
    .values({ id: 1, ratesFetchedAt: now })
    .onConflictDoUpdate({ target: appSettings.id, set: { ratesFetchedAt: now } });

  // Instantané quotidien pour le graphique d'évolution (idempotent sur la journée).
  await recordTodaySnapshot(now);
  // Rétro-remplissage du taux marché sur 4 mois si l'historique est vide ou trop court.
  await backfillMarketHistory(now);

  return { fetched: true, rate: marketRate, date: marketDate, banks, banksError };
}

/** Enregistre l'état actuel de toutes les lignes de taux dans l'historique du jour. */
async function recordTodaySnapshot(now: number): Promise<void> {
  const today = new Date(now * 1000);
  today.setHours(0, 0, 0, 0);
  const todayStart = Math.floor(today.getTime() / 1000);
  await db.delete(rateHistory).where(gte(rateHistory.recordedAt, todayStart));
  const all = await db.select().from(rates);
  if (all.length) {
    await db
      .insert(rateHistory)
      .values(
        all.map((r) => ({
          bank: r.bank,
          rate: r.rate,
          durationYears: r.durationYears,
          source: r.source,
          recordedAt: now,
        })),
      );
  }
}

/**
 * Complète l'historique du taux marché avec la série officielle (mensuelle),
 * sur les 4 mois précédant aujourd'hui, si l'historique est vide ou plus court.
 * Les barèmes par banque n'étant pas publiés rétroactivement, seuls le marché est rétro-rempli.
 */
async function backfillMarketHistory(now: number): Promise<void> {
  // 135 jours : 4 mois pleins avant aujourd'hui, mois en cours inclus.
  const fourMonthsAgo = now - 135 * 86_400;
  const oldest = await db
    .select({ recordedAt: rateHistory.recordedAt })
    .from(rateHistory)
    .where(and(eq(rateHistory.source, MARKET_SOURCE), lt(rateHistory.recordedAt, now)))
    .orderBy(asc(rateHistory.recordedAt))
    .limit(1);
  if (oldest.length && oldest[0].recordedAt < fourMonthsAgo) return; // déjà couvert
  try {
    const series = await fetchMarketSeries();
    await db
      .delete(rateHistory)
      .where(and(eq(rateHistory.source, MARKET_SOURCE), lt(rateHistory.recordedAt, now)));
    const rows = series
      .filter((s) => s.recordedAt >= fourMonthsAgo && s.recordedAt < now)
      .map((s) => ({
        bank: "Marché (Banque de France)",
        rate: s.rate,
        durationYears: null,
        source: MARKET_SOURCE,
        recordedAt: s.recordedAt,
      }));
    if (rows.length) await db.insert(rateHistory).values(rows);
  } catch {
    // Échec du rétro-remplissage : le graphique affichera ce qui a été relevé localement.
  }
}
