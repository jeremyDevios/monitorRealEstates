"use client";

import { useActionState } from "react";
import { createLabelAction, deleteLabelAction } from "@/lib/actions/labels";
import { Button, Field, inputCls } from "@/components/ui";

const COLORS = [
  "#2e6b4f",
  "#b3452f",
  "#8f6416",
  "#3f5d8a",
  "#6b5b95",
  "#3f7f7a",
  "#7a4b6b",
  "#5a6b3f",
];

export function LabelCreateForm() {
  const [state, formAction, pending] = useActionState(createLabelAction, undefined);
  return (
    <form action={formAction} className="max-w-sm space-y-4">
      {state?.error ? (
        <p className="border-l-2 border-offline pl-3 text-sm text-offline">{state.error}</p>
      ) : null}
      <Field label="Nom">
        <input name="name" className={inputCls} maxLength={40} required />
      </Field>
      <div>
        <span className="mb-1 block text-xs text-muted">Couleur</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer" title={c}>
              <input type="radio" name="color" value={c} defaultChecked={c === COLORS[0]} className="peer sr-only" />
              <span
                className="block h-6 w-6 rounded-full border-2 border-transparent peer-checked:border-ink"
                style={{ backgroundColor: c }}
              />
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Ajout…" : "Ajouter l'étiquette"}
      </Button>
    </form>
  );
}

export function LabelDeleteButton({ id, name }: { id: number; name: string }) {
  return (
    <form
      action={deleteLabelAction}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer l'étiquette « ${name} » ? Elle sera retirée des annonces qui la portent.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="label_id" value={id} />
      <button type="submit" className="text-xs text-muted underline-offset-4 hover:text-offline hover:underline">
        Supprimer
      </button>
    </form>
  );
}
