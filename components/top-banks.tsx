"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveSettingsAction } from "@/lib/actions/credit";
import { computePlan, MARKET_SOURCE, NOTARY_FEES_PCT, paymentFor, type CreditSettings } from "@/lib/credit";
import { formatPrice } from "@/lib/format";
import { Button, cardCls, Field, inputCls } from "@/components/ui";

type RateRow = {
  id: number;
  bank: string;
  rate: number;
  durationYears: number | null;
  source: string;
  sourceUrl: string | null;
};

export function TopBanks({ rates, settings }: { rates: RateRow[]; settings: CreditSettings }) {
  const [state, formAction, pending] = useActionState(saveSettingsAction, undefined);
  const [budget, setBudget] = useState(String(settings.monthlyBudget));
  const [apport, setApport] = useState(String(settings.downPayment));
  const [duration, setDuration] = useState(String(settings.durationYears));
  const [assurance, setAssurance] = useState("");
  const [fees, setFees] = useState(true);
  const [target, setTarget] = useState("");

  const num = (s: string) => (s.trim() && Number.isFinite(Number(s.replace(",", "."))) ? Number(s.replace(",", ".")) : 0);
  const budgetN = num(budget);
  const apportN = num(apport);
  const durationN = Math.min(35, Math.max(5, num(duration) || 20));
  const assuranceN = num(assurance);
  const targetN = num(target);
  const err = (k: string) => state?.fieldErrors?.[k] ?? null;

  const candidates = rates.filter((r) => r.durationYears == null || r.durationYears === durationN);
  const top5 = [...candidates].sort((a, b) => a.rate - b.rate).slice(0, 5);

  const plans = top5.map((r) => ({
    ...r,
    plan: computePlan({ monthlyBudget: budgetN, downPayment: apportN, durationYears: durationN }, r.rate, assuranceN),
    required: targetN > 0 ? paymentFor(Math.max(0, targetN - apportN), r.rate, durationN, assuranceN) : null,
  }));

  const best = plans[0];

  return (
    <div>
      <form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Field label="Budget mensuel max (€ / mois)">
            <input
              name="monthly_budget"
              className={inputCls}
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="1600"
            />
            {err("monthly_budget") ? <p className="mt-1 text-xs text-offline">{err("monthly_budget")}</p> : null}
          </Field>
        </div>
        <div>
          <Field label="Apport (€)">
            <input
              name="down_payment"
              className={inputCls}
              inputMode="numeric"
              value={apport}
              onChange={(e) => setApport(e.target.value)}
              placeholder="60000"
            />
            {err("down_payment") ? <p className="mt-1 text-xs text-offline">{err("down_payment")}</p> : null}
          </Field>
        </div>
        <div>
          <Field label="Durée souhaitée">
            <select
              name="duration_years"
              className={inputCls}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {[10, 15, 20, 25, 30, 35].map((d) => (
                <option key={d} value={d}>
                  {d} ans
                </option>
              ))}
            </select>
            {err("duration_years") ? <p className="mt-1 text-xs text-offline">{err("duration_years")}</p> : null}
          </Field>
        </div>
        <div>
          <Field label="Prix du bien visé (optionnel)">
            <input
              name="target_price"
              className={inputCls}
              inputMode="numeric"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="ex. 320000"
            />
          </Field>
        </div>
        <div>
          <Field label="Assurance emprunteur (% / an)" hint="0,3 % est une base courante.">
            <input
              name="insurance_pct"
              className={inputCls}
              inputMode="decimal"
              value={assurance}
              onChange={(e) => setAssurance(e.target.value)}
              placeholder="0,3"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm text-muted">
          <input
            type="checkbox"
            checked={fees}
            onChange={(e) => setFees(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Inclure les frais de notaire (~{String(NOTARY_FEES_PCT).replace(".", ",")} %)
        </label>
        <div className="flex items-end sm:col-span-2">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer comme paramètres communs"}
          </Button>
          {state?.ok ? <span className="ml-3 text-sm text-accent">Enregistré.</span> : null}
        </div>
      </form>

      {best ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <ResultTile
              label={`Prêt possible — ${best.bank}`}
              value={formatPrice(best.plan.capacity * 100)}
              sub={`${formatPrice(best.plan.monthlyBudget * 100)} / mois pendant ${durationN} ans`}
              highlight
            />
            <ResultTile
              label="Budget total (prêt + apport)"
              value={formatPrice(best.plan.budget * 100)}
              sub={`dont ${formatPrice(best.plan.interest * 100)} d'intérêts`}
            />
            {fees ? (
              <ResultTile
                label="Prix max du bien (frais inclus)"
                value={formatPrice(best.plan.priceWithFees * 100)}
                sub={`frais de notaire ≈ ${formatPrice(best.plan.fees * 100)}`}
              />
            ) : null}
          </div>

          <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th className="py-3 pl-4 pr-3 font-medium">Banque</th>
                  <th className="py-3 pr-3 text-right font-medium">Taux</th>
                  <th className="py-3 pr-3 text-right font-medium">Prêt possible</th>
                  <th className="py-3 pr-3 text-right font-medium">Budget total</th>
                  {fees ? <th className="py-3 pr-3 text-right font-medium">Prix max du bien</th> : null}
                  {targetN > 0 ? <th className="py-3 pr-4 text-right font-medium">Mensualité requise</th> : null}
                </tr>
              </thead>
              <tbody>
                {plans.map(({ id, bank, rate, source, sourceUrl, plan, required }) => (
                  <tr key={id} className="border-b border-line/60 last:border-0">
                    <td className="py-3 pl-4 pr-3">
                      <span className="flex items-center gap-2">
                        {bank}
                        {source === MARKET_SOURCE ? (
                          <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">marché</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted">dont {formatPrice(plan.interest * 100)} d’intérêts</span>
                      {sourceUrl ? (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted underline-offset-4 hover:text-accent hover:underline"
                        >
                          vérifier la source ↗
                        </a>
                      ) : null}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-accent">
                      {String(rate).replace(".", ",")} %
                    </td>
                    <td className="py-3 pr-3 text-right font-mono font-semibold">
                      {formatPrice(plan.capacity * 100)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono">{formatPrice(plan.budget * 100)}</td>
                    {fees ? (
                      <td className="py-3 pr-3 text-right font-mono">{formatPrice(plan.priceWithFees * 100)}</td>
                    ) : null}
                    {targetN > 0 ? (
                      <td className="py-3 pr-4 text-right">
                        <span className="font-mono">{formatPrice(required! * 100)} / mois</span>
                        {required != null && required <= budgetN ? (
                          <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                            OK
                          </span>
                        ) : (
                          <span className="ml-2 rounded-full border border-offline/40 bg-offline/10 px-2 py-0.5 text-xs text-offline">
                            dépasse de {formatPrice((required! - budgetN) * 100)} / mois
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-6 rounded-xl border border-dashed border-line p-6 text-sm text-muted">
          {rates.length === 0
            ? "Aucun taux disponible : actualise le taux du marché ci-dessus ou ajoute des banques."
            : `Aucun taux pour une durée de ${durationN} ans : ajoute une banque avec cette durée ou choisis une autre durée.`}
        </p>
      )}
    </div>
  );
}

function ResultTile({ label, value, sub, highlight = false }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`${cardCls} p-4 ${highlight ? "border-accent/40 bg-accent/5" : ""}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold tracking-tight ${highlight ? "text-accent" : ""}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
