"use client";

import { useActionState } from "react";
import { refreshRatesAction } from "@/lib/actions/credit";
import { btnGhostCls } from "@/components/ui";

export function RefreshRatesButton() {
  const [state, formAction, pending] = useActionState(refreshRatesAction, undefined);
  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={pending} className={`${btnGhostCls} px-3 py-1.5`}>
        {pending ? "Actualisation…" : "Actualiser les taux"}
      </button>
      {state?.message ? <p className="mt-1.5 text-xs text-accent">{state.message}</p> : null}
      {state?.error ? <p className="mt-1.5 text-xs text-offline">{state.error}</p> : null}
    </form>
  );
}
