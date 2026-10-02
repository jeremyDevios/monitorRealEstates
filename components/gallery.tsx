"use client";

import { useState } from "react";

export function Gallery({ photos }: { photos: { id: number; path: string }[] }) {
  const [sel, setSel] = useState(0);
  if (!photos.length) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line bg-surface text-sm text-muted">
        Aucune photo enregistrée.
      </div>
    );
  }
  const current = photos[Math.min(sel, photos.length - 1)];
  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={current.id}
        src={current.path}
        alt=""
        className="aspect-[4/3] w-full rounded-xl border border-line object-cover"
      />
      {photos.length > 1 ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                i === sel ? "border-accent" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.path} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
