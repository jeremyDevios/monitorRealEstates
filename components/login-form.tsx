"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/actions/auth";
import { Button, Field, inputCls } from "@/components/ui";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="border-l-2 border-offline pl-3 text-sm text-offline">{state.error}</p>
      ) : null}
      <Field label="Identifiant">
        <input name="username" className={inputCls} autoComplete="username" required autoFocus />
      </Field>
      <Field label="Mot de passe">
        <input name="password" type="password" className={inputCls} autoComplete="current-password" required />
      </Field>
      <Button type="submit" variant="primary" disabled={pending} className="w-full">
        {pending ? "Connexion…" : "Entrer dans le carnet"}
      </Button>
    </form>
  );
}
