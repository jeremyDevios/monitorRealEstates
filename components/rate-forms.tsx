"use client";

import { useActionState } from "react";
import { addRateAction, deleteRateAction } from "@/lib/actions/credit";
import { Button, Field, inputCls } from "@/components/ui";

export function RateAddForm() {
  const [state, formAction, pending] = useActionState(addRateAction, undefined);
  const err = (k: string) => state?.fieldErrors?.[k] ?? null;
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-[1fr_140px_160px_auto] sm:items-end">
      {state?.ok ? <p className="text-sm text-accent sm:col-span-4">Taux ajouté.</p> : null}
      <div>
        <Field label="Organisme">
          <input name="bank" className={inputCls} maxLength={60} required />
        </Field>
        {err("bank") ? <p className="mt-1 text-xs text-offline">{err("bank")}</p> : null}
      </div>
      <div>
        <Field label="Taux (%)">
          <input name="rate" className={inputCls} inputMode="decimal" placeholder="3,5" required />
        </Field>
        {err("rate") ? <p className="mt-1 text-xs text-offline">{err("rate")}</p> : null}
      </div>
      <div>
        <Field label="Durée (années)">
          <select name="duration_years" className={inputCls} defaultValue="20">
            <option value="">Toutes durées</option>
            {[10, 15, 20, 25, 30, 35].map((d) => (
              <option key={d} value={d}>
                {d} ans
              </option>
            ))}
          </select>
        </Field>
        {err("duration_years") ? <p className="mt-1 text-xs text-offline">{err("duration_years")}</p> : null}
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter"}
      </Button>
    </form>
  );
}

export function RateDeleteButton({ id, bank }: { id: number; bank: string }) {
  return (
    <form
      action={deleteRateAction}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer le taux de « ${bank} » ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="rate_id" value={id} />
      <button type="submit" className="text-xs text-muted underline-offset-4 hover:text-offline hover:underline">
        Supprimer
      </button>
    </form>
  );
}
