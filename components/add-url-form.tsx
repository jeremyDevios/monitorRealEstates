"use client";

import { useActionState } from "react";
import { addListingFromUrlAction } from "@/lib/actions/listings";
import { Button, Field, inputCls } from "@/components/ui";

export function AddUrlForm() {
  const [state, formAction, pending] = useActionState(addListingFromUrlAction, undefined);
  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <p className="border-l-2 border-offline pl-3 text-sm text-offline">{state.error}</p>
      ) : null}
      <Field
        label="URL de l'annonce"
        hint="Titre, description, prix, surfaces, pièces, ville et photos sont récupérés puis archivés localement."
      >
        <input
          name="url"
          type="url"
          className={inputCls}
          placeholder="https://www.leboncoin.fr/ad/…"
          required
        />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Récupération…" : "Récupérer l'annonce"}
      </Button>
    </form>
  );
}
