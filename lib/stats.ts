import { and, desc, eq, sql } from "drizzle-orm";
import { db, listingChecks, ratings } from "@/lib/db";

/** listingId → écart de prix (en centimes) entre l'avant-dernier et le dernier prix concluant. */
export async function getPriceDrops(): Promise<Map<number, number>> {
  const checks = await db
    .select({ listingId: listingChecks.listingId, priceCents: listingChecks.priceCents })
    .from(listingChecks)
    .where(and(eq(listingChecks.conclusive, true), sql`${listingChecks.priceCents} IS NOT NULL`))
    .orderBy(desc(listingChecks.checkedAt));
  const lastTwo = new Map<number, number[]>();
  for (const c of checks) {
    const arr = lastTwo.get(c.listingId) ?? [];
    if (arr.length < 2 && c.priceCents != null) {
      arr.push(c.priceCents);
      lastTwo.set(c.listingId, arr);
    }
  }
  const drops = new Map<number, number>();
  for (const [listingId, [latest, prev]] of lastTwo) {
    if (prev != null && latest != null && prev > latest) drops.set(listingId, prev - latest);
  }
  return drops;
}

/** listingId → note moyenne et nombre de votes. */
export async function getRatingStats(): Promise<Map<number, { avg: number; n: number }>> {
  const rows = await db
    .select({
      listingId: ratings.listingId,
      avg: sql<number>`avg(${ratings.stars})`.as("avg"),
      n: sql<number>`count(*)`.as("n"),
    })
    .from(ratings)
    .groupBy(ratings.listingId);
  return new Map(rows.map((r) => [r.listingId, { avg: r.avg, n: r.n }]));
}
