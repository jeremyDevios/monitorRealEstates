import type { ButtonHTMLAttributes, ReactNode } from "react";
import { formatPrice } from "@/lib/format";

export const inputCls =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink placeholder:text-muted/60 transition-colors focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/30";

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimaryCls = `${btnBase} bg-accent text-accent-fg hover:bg-accent/85`;
export const btnGhostCls = `${btnBase} border border-line text-ink hover:border-accent/50 hover:text-accent`;
export const cardCls = "rounded-xl border border-line bg-surface";

export function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  return <button className={`${variant === "primary" ? btnPrimaryCls : btnGhostCls} ${className}`} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted/80">{hint}</span> : null}
    </label>
  );
}

export type ListingStatus = "online" | "offline" | "unknown";

const STATUS_CFG: Record<ListingStatus, { label: string; cls: string; dot: string }> = {
  online: { label: "En ligne", cls: "border-accent/40 bg-accent/10 text-accent", dot: "bg-accent" },
  offline: { label: "Hors ligne", cls: "border-offline/40 bg-offline/10 text-offline", dot: "bg-offline" },
  unknown: { label: "Statut inconnu", cls: "border-dashed border-line bg-surface-2 text-muted", dot: "bg-muted" },
};

export function StatusPill({ status }: { status: ListingStatus }) {
  const cfg = STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function LabelChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

export function PriceDrop({ deltaCents }: { deltaCents: number }) {
  return <span className="ml-2 font-mono text-xs text-offline">−{formatPrice(deltaCents)}</span>;
}

export function StatTile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className={`${cardCls} p-5`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}

export function StarsDisplay({ avg, count }: { avg: number | null; count?: number }) {
  if (avg == null) return <span className="text-xs text-muted">—</span>;
  const filled = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-sm leading-none text-warn">
        {"★".repeat(filled)}
        <span className="text-muted/40">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="font-mono text-xs text-muted">
        {avg.toFixed(1)}
        {count != null ? ` (${count})` : ""}
      </span>
    </span>
  );
}

export function Thumb({ path, title }: { path: string | null | undefined; title: string }) {
  if (!path) {
    return (
      <div
        className="flex h-11 w-16 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-muted"
        title={title}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
      </div>
    );
  }
  // Photos locales écrites à la volée : <img> volontaire (pas d'optimisation nécessaire).
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={path} alt="" loading="lazy" className="h-11 w-16 shrink-0 rounded-md border border-line object-cover" />;
}

export function HouseMark() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    </span>
  );
}
