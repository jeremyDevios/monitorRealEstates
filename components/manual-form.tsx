"use client";

import { useActionState } from "react";
import { addListingManualAction } from "@/lib/actions/listings";
import { Button, Field, inputCls } from "@/components/ui";

export function ManualForm({ labels }: { labels: { id: number; name: string }[] }) {
  const [state, formAction, pending] = useActionState(addListingManualAction, undefined);
  const err = (k: string) => state?.fieldErrors?.[k] ?? null;
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state?.error ? (
        <p className="border-l-2 border-offline pl-3 text-sm text-offline sm:col-span-2">{state.error}</p>
      ) : null}
      <div className="sm:col-span-2">
        <Field label="Titre">
          <input name="title" className={inputCls} required />
        </Field>
        {err("title") ? <p className="mt-1 text-xs text-offline">{err("title")}</p> : null}
      </div>
      <Field label="URL Leboncoin (optionnelle)">
        <input name="url" className={inputCls} placeholder="https://www.leboncoin.fr/ad/…" />
      </Field>
      {err("url") ? <p className="text-xs text-offline">{err("url")}</p> : null}
      <Field label="Prix (€)">
        <input name="price" className={inputCls} inputMode="numeric" placeholder="245000" />
      </Field>
      <Field label="Surface habitable (m²)">
        <input name="habitable_m2" className={inputCls} inputMode="decimal" placeholder="120" />
      </Field>
      <Field label="Surface du jardin (m²)">
        <input name="garden_m2" className={inputCls} inputMode="decimal" placeholder="800" />
      </Field>
      <Field label="Nombre de pièces">
        <input name="rooms" className={inputCls} inputMode="numeric" placeholder="5" />
      </Field>
      <Field label="Ville">
        <input name="city" className={inputCls} />
      </Field>
      <Field label="Code postal">
        <input name="postal_code" className={inputCls} />
      </Field>
      <Field label="Fourchette basse (€ / m²)">
        <input name="ppm_min" className={inputCls} inputMode="decimal" placeholder="1800" />
      </Field>
      <Field label="Fourchette haute (€ / m²)">
        <input name="ppm_max" className={inputCls} inputMode="decimal" placeholder="2200" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Étiquette">
          <select name="label_id" className={inputCls} defaultValue="">
            <option value="">Aucune</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Description">
          <textarea name="description" rows={5} className={inputCls} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Photos" hint="12 photos maximum, 15 Mo chacune.">
          <input
            type="file"
            name="photos"
            accept="image/*"
            multiple
            className="block w-full text-sm text-muted file:mr-3 file:border file:border-line file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:border-accent"
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l'annonce"}
        </Button>
      </div>
    </form>
  );
}
