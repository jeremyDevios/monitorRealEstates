"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cardCls, inputCls } from "@/components/ui";

export type HistoryRow = {
  bank: string;
  rate: number;
  durationYears: number | null;
  recordedAt: number;
};

// Slots catégoriels sombres, validés contre notre surface (#12161a) :
// fixe par banque — une entité garde sa couleur quel que soit le filtre.
const SERIES_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const MARKET_BANK = "Marché (Banque de France)";

const dateShort = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });
const dateFull = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtDate = (t: number) => dateShort.format(new Date(t * 1000));
const fmtRate = (v: number) => `${String(v).replace(".", ",")} %`;

type TooltipPayload = { dataKey?: string | number; name?: string; value?: number; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}) {
  if (!active || !payload?.length || label == null) return null;
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium">{dateFull.format(new Date(label * 1000))}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}</span>
          <span className="ml-auto pl-4 font-mono tabular-nums">{p.value != null ? fmtRate(p.value) : "—"}</span>
        </p>
      ))}
    </div>
  );
}

export function RateChart({ history }: { history: HistoryRow[] }) {
  const durations = useMemo(() => {
    const set = new Set<string>();
    history.forEach((r) => set.add(r.durationYears == null ? "market" : String(r.durationYears)));
    return [...set].sort((a, b) => (a === "market" ? -1 : b === "market" ? 1 : Number(a) - Number(b)));
  }, [history]);
  const [duration, setDuration] = useState(durations.includes("20") ? "20" : (durations[0] ?? "market"));
  const [bank, setBank] = useState("all");

  const banks = useMemo(() => {
    const set = new Set<string>();
    history
      .filter((r) => (duration === "market" ? r.durationYears == null : r.durationYears === Number(duration)))
      .forEach((r) => set.add(r.bank));
    return [...set].sort((a, b) => (a === MARKET_BANK ? -1 : b === MARKET_BANK ? 1 : a.localeCompare(b)));
  }, [history, duration]);

  // Couleur fixe par banque, assignée une fois sur l'ensemble des banques connues.
  const colorOf = useMemo(() => {
    const all = new Set<string>();
    history.forEach((r) => all.add(r.bank));
    const ordered = [MARKET_BANK, ...[...all].filter((b) => b !== MARKET_BANK).sort((a, b) => a.localeCompare(b))];
    return (name: string) => {
      const i = ordered.indexOf(name);
      return i >= 0 && i < SERIES_COLORS.length ? SERIES_COLORS[i] : "#8b96a1";
    };
  }, [history]);

  const data = useMemo(() => {
    const byDate = new Map<number, Record<string, number>>();
    history
      .filter((r) => (duration === "market" ? r.durationYears == null : r.durationYears === Number(duration)))
      .forEach((r) => {
        const d = byDate.get(r.recordedAt) ?? {};
        d[r.bank] = r.rate;
        byDate.set(r.recordedAt, d);
      });
    return [...byDate.entries()].sort((a, b) => a[0] - b[0]).map(([t, values]) => ({ t, ...values }));
  }, [history, duration]);

  const series = bank === "all" ? banks : [bank];

  if (!history.length) return null;
  if (!data.length) {
    return (
      <div className={`${cardCls} p-5`}>
        <p className="text-sm text-muted">Aucune donnée pour cette sélection.</p>
      </div>
    );
  }

  return (
    <div className={`${cardCls} p-5`}>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Durée du prêt</span>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={`${inputCls} w-auto`}
          >
            {durations.map((d) => (
              <option key={d} value={d}>
                {d === "market" ? "Marché (toutes durées)" : `${d} ans`}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Banque</span>
          <select value={bank} onChange={(e) => setBank(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="all">Toutes</option>
            {banks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#232c34" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={fmtDate}
              tick={{ fill: "#8b96a1", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#383835" }}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={fmtRate}
              tick={{ fill: "#8b96a1", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={54}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#8b96a1", strokeDasharray: "3 3" }} />
            <Legend
              formatter={(value) => (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{value}</span>
              )}
            />
            {series.map((name) => (
              <Line
                key={name}
                dataKey={name}
                stroke={colorOf(name)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                type="monotone"
                connectNulls
                animationDuration={700}
                animationEasing="ease-out"
                strokeDasharray={name === MARKET_BANK ? "6 4" : undefined}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
