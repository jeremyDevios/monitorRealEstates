import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

// Baromètre MoneyVox : taux par banque (banques en ligne), relevés sur leur page publique.
// Les banques traditionnelles ne publient pas de barèmes accessibles : leurs taux se
// saisissent à la main depuis les offres reçues.
export const MONEYVOX_URL = "https://www.moneyvox.fr/credit/barometre-taux.php";

const DURATIONS = [7, 10, 15, 20, 25];
const KEPT_DURATIONS = new Set([10, 15, 20, 25]);

export type BankRate = { bank: string; rate: number; durationYears: number; sourceUrl: string };

function parseRate(cell: string): number | null {
  const cleaned = cell.replace(/\s+/g, "").replace(",", ".").replace("%", "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 && n < 15 ? n : null;
}

function bankNameFromCell($: cheerio.CheerioAPI, cell: cheerio.Cheerio<AnyNode>): string | null {
  const linkTitle = cell.find("a").first().attr("title");
  if (linkTitle) {
    return linkTitle.replace(/^Prêt immobilier\s+/i, "").trim() || null;
  }
  const imgAlt = cell.find("img").first().attr("alt");
  if (imgAlt) {
    return imgAlt.replace(/^Logo\s+/i, "").replace(/\s+B(anque)?$/i, "").trim() || null;
  }
  return null;
}

export function parseMoneyVoxBanks(html: string): BankRate[] {
  const $ = cheerio.load(html);
  const rows: BankRate[] = [];
  // La table « Banque » est la seconde table de la page (la première donne bon/très bon/excellent).
  const table = $("table").eq(1);
  if (!table.length) return rows;
  table.find("tr").each((_, tr) => {
    const cells = $(tr).find("th,td").toArray();
    if (cells.length !== DURATIONS.length + 1) return;
    const name = bankNameFromCell($, $(cells[0]));
    if (!name) return; // ligne d'en-tête ou « Taux du marché »
    DURATIONS.forEach((years, i) => {
      if (!KEPT_DURATIONS.has(years)) return;
      const rate = parseRate($(cells[i + 1]).text());
      if (rate != null) {
        rows.push({ bank: name, rate, durationYears: years, sourceUrl: MONEYVOX_URL });
      }
    });
  });
  return rows;
}

export async function fetchBankRates(): Promise<BankRate[]> {
  const res = await fetch(MONEYVOX_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const banks = parseMoneyVoxBanks(html);
  if (banks.length === 0) throw new Error("Aucune banque trouvée dans le baromètre");
  return banks;
}
