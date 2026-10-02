import { gte, eq, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth/session";
import { appSettings, db, rateHistory, rates } from "@/lib/db";
import { DEFAULT_CREDIT_SETTINGS, MARKET_SOURCE, type CreditSettings } from "@/lib/credit";
import { formatDate, formatDateTime } from "@/lib/format";
import { cardCls } from "@/components/ui";
import { RateAddForm, RateDeleteButton } from "@/components/rate-forms";
import { RateChart } from "@/components/rate-chart";
import { RefreshRatesButton } from "@/components/refresh-rates-button";
import { TopBanks } from "@/components/top-banks";

export default async function CreditPage() {
  await requireUser();
  const settingsRow = await db.query.appSettings.findFirst({ where: eq(appSettings.id, 1) });
  const settings: CreditSettings = settingsRow
    ? {
        monthlyBudget: settingsRow.monthlyBudget,
        downPayment: settingsRow.downPayment,
        durationYears: settingsRow.durationYears,
      }
    : DEFAULT_CREDIT_SETTINGS;
  const rateRows = await db.select().from(rates).orderBy(rates.rate);

  // Historique pour le graphique d'évolution : les 4 derniers mois (borne calculée en SQL).
  const historyRows = await db
    .select({
      bank: rateHistory.bank,
      rate: rateHistory.rate,
      durationYears: rateHistory.durationYears,
      recordedAt: rateHistory.recordedAt,
    })
    .from(rateHistory)
    .where(gte(rateHistory.recordedAt, sql`unixepoch() - ${140 * 86_400}`))
    .orderBy(rateHistory.recordedAt);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Crédit</h1>
          <p className="mt-1 text-sm text-muted">
            Meilleurs taux et capacité d’emprunt, recalculés en direct selon tes paramètres.
            {settingsRow?.ratesFetchedAt
              ? ` Taux du marché actualisés le ${formatDate(settingsRow.ratesFetchedAt)}.`
              : " Taux du marché pas encore actualisés."}
          </p>
        </div>
        <RefreshRatesButton />
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold tracking-tight">Simulation et top 5 des taux</h2>
        <div className={`${cardCls} mt-3 p-5`}>
          <TopBanks rates={rateRows} settings={settings} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Taux enregistrés</h2>
        <p className="mt-1 text-xs text-muted">
          Les barèmes des banques traditionnelles ne sont pas publiés en ligne : ajoute ici le taux
          proposé par ta banque ou ton courtier pour le comparer au barème relevé automatiquement.
        </p>
        <div className={`${cardCls} mt-3 p-5`}>
          <RateAddForm />
          {rateRows.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Aucun taux pour l’instant — actualise le taux du marché ou ajoute les banques que tu
              connais (banque, courtier…).
            </p>
          ) : (
            <table className="mt-5 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Organisme</th>
                  <th className="py-2 pr-3 text-right font-medium">Taux</th>
                  <th className="py-2 pr-3 text-right font-medium">Durée</th>
                  <th className="py-2 pr-3 font-medium">Mis à jour</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rateRows.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="flex items-center gap-2">
                        {r.bank}
                        {r.source === MARKET_SOURCE ? (
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
                            marché (automatique)
                          </span>
                        ) : r.source === "web" ? (
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
                            relevé sur le web
                          </span>
                        ) : null}
                      </span>
                      {r.sourceUrl ? (
                        <a
                          href={r.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-muted underline-offset-4 hover:text-accent hover:underline"
                        >
                          vérifier la source ↗
                        </a>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono text-accent">
                      {String(r.rate).replace(".", ",")} %
                    </td>
                    <td className="py-2.5 pr-3 text-right">
                      {r.durationYears != null ? `${r.durationYears} ans` : "toutes"}
                    </td>
                    <td className="py-2.5 pr-3 text-muted">{formatDateTime(r.updatedAt)}</td>
                    <td className="py-2.5 text-right">
                      <RateDeleteButton id={r.id} bank={r.bank} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">Évolution des taux — 4 derniers mois</h2>
        <p className="mt-1 text-xs text-muted">
          Un instantané par jour pour chaque banque relevée ; le taux marché (Banque de France)
          est complété chaque mois grâce à sa série officielle. Filtre par durée et par banque.
        </p>
        <div className="mt-3">
          <RateChart history={historyRows} />
        </div>
      </section>
    </div>
  );
}
