"use client";

import { deleteListingAction } from "@/lib/actions/listings";

export function DeleteListingButton({ id, title }: { id: number; title: string }) {
  return (
    <form
      action={deleteListingAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer l'annonce « ${title} » ? Les photos, la discussion et les votes seront perdus.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="listing_id" value={id} />
      <button
        type="submit"
        className="w-full rounded-lg border border-offline/40 px-4 py-2 text-sm text-offline transition-colors hover:bg-offline/10"
      >
        Supprimer l’annonce
      </button>
    </form>
  );
}
