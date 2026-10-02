"use client";

import { useActionState } from "react";
import { updateListingAction } from "@/lib/actions/listings";
import { Button, Field, inputCls } from "@/components/ui";

type Values = {
  title: string;
  url: string;
  price: string;
  habitable_m2: string;
  garden_m2: string;
  rooms: string;
  city: string;
  postal_code: string;
  ppm_min: string;
  ppm_max: string;
  description: string;
  label_id: string;
};

export function EditListingForm({
  listingId,
  values,
  labels,
}: {
  listingId: number;
  values: Values;
  labels: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateListingAction, undefined);
  const err = (k: string) => state?.fieldErrors?.[k] ?? null;
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="listing_id" value={listingId} />
      {state?.ok ? (
        <p className="text-sm text-accent sm:col-span-2">La fiche a été mise à jour.</p>
      ) : null}
      <div className="sm:col-span-2">
        <Field label="Titre">
          <input name="title" className={inputCls} defaultValue={values.title} required />
        </Field>
        {err("title") ? <p className="mt-1 text-xs text-offline">{err("title")}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <Field label="URL Leboncoin (optionnelle)">
          <input name="url" className={inputCls} defaultValue={values.url} />
        </Field>
        {err("url") ? <p className="mt-1 text-xs text-offline">{err("url")}</p> : null}
      </div>
      <Field label="Prix (€)">
        <input name="price" className={inputCls} inputMode="numeric" defaultValue={values.price} />
      </Field>
      <Field label="Surface habitable (m²)">
        <input
          name="habitable_m2"
          className={inputCls}
          inputMode="decimal"
          defaultValue={values.habitable_m2}
        />
      </Field>
      <Field label="Surface du jardin (m²)">
        <input name="garden_m2" className={inputCls} inputMode="decimal" defaultValue={values.garden_m2} />
      </Field>
      <Field label="Nombre de pièces">
        <input name="rooms" className={inputCls} inputMode="numeric" defaultValue={values.rooms} />
      </Field>
      <Field label="Ville">
        <input name="city" className={inputCls} defaultValue={values.city} />
      </Field>
      <Field label="Code postal">
        <input name="postal_code" className={inputCls} defaultValue={values.postal_code} />
      </Field>
      <Field label="Fourchette basse (€ / m²)">
        <input name="ppm_min" className={inputCls} inputMode="decimal" defaultValue={values.ppm_min} />
      </Field>
      <Field label="Fourchette haute (€ / m²)">
        <input name="ppm_max" className={inputCls} inputMode="decimal" defaultValue={values.ppm_max} />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Étiquette">
          <select name="label_id" className={inputCls} defaultValue={values.label_id}>
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
          <textarea name="description" rows={5} className={inputCls} defaultValue={values.description} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les modifications"}
        </Button>
      </div>
    </form>
  );
}
