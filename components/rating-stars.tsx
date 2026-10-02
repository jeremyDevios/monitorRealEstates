"use client";

import { useState } from "react";
import { useActionState } from "react";
import { rateListingAction } from "@/lib/actions/ratings";

export function RatingStars({
  listingId,
  myStars,
  avg,
  count,
}: {
  listingId: number;
  myStars: number | null;
  avg: number | null;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(rateListingAction, undefined);
  const [hover, setHover] = useState(0);
  const shown = hover > 0 ? hover : myStars;
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-muted">Ta note</p>
      <form action={formAction} className="mt-1.5" onMouseLeave={() => setHover(0)}>
        <input type="hidden" name="listing_id" value={listingId} />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="submit"
              name="stars"
              value={n}
              disabled={pending}
              onMouseEnter={() => setHover(n)}
              aria-label={`Noter ${n} sur 5`}
              className={`text-xl leading-none transition-colors ${
                shown != null && n <= shown ? "text-warn" : "text-muted/40 hover:text-warn/70"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </form>
      {state?.ok ? (
        <p className="mt-1 text-xs text-accent">Note enregistrée.</p>
      ) : state?.error ? (
        <p className="mt-1 text-xs text-offline">{state.error}</p>
      ) : null}
      <p className="mt-1.5 text-xs text-muted">
        Moyenne :{" "}
        {avg != null ? (
          <span className="text-ink">
            {avg.toFixed(1)} / 5 ({count} vote{count > 1 ? "s" : ""})
          </span>
        ) : (
          "pas encore de vote"
        )}
      </p>
    </div>
  );
}
