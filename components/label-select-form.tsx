"use client";

import { setListingLabelAction } from "@/lib/actions/listings";
import { inputCls } from "@/components/ui";

export function LabelSelectForm({
  listingId,
  current,
  labels,
}: {
  listingId: number;
  current: number | null;
  labels: { id: number; name: string }[];
}) {
  return (
    <form action={setListingLabelAction}>
      <input type="hidden" name="listing_id" value={listingId} />
      <select
        name="label_id"
        defaultValue={current ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={inputCls}
      >
        <option value="">Aucune</option>
        {labels.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </form>
  );
}
