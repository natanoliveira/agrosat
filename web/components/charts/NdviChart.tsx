"use client";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Alert, Scene } from "@/lib/api-types";
import { formatDate, formatNdvi } from "@/lib/format";

const COR = { folha: "#3f6b2a", alta: "#a8321f", media: "#8a5a2b", mut: "#56604f" };
const short = (iso: string) => formatDate(iso).slice(0, 5);

function Marker({ cx, cy, color }: { cx?: number; cy?: number; color: string }) {
  if (cx == null || cy == null) return null;
  const y = cy - 14;
  return (
    <g>
      <path d={`M${cx},${y - 8} l8,14 h-16z`} fill={color} stroke="#fff" strokeWidth={1.2} />
      <text x={cx} y={y + 4} fontSize={9} fontWeight={700} textAnchor="middle" fill="#fff">!</text>
    </g>
  );
}

export default function NdviChart({
  scenes, alerts, date, onSelect, label,
}: { scenes: Scene[]; alerts: Alert[]; date: string | null; onSelect?: (d: string) => void; label: string }) {
  const data = scenes.map((s) => ({ date: s.date, mean: s.mean, band: s.p10 != null && s.p90 != null ? [s.p10, s.p90] : null }));
  const byDate = new Map(scenes.map((s) => [s.date, s]));
  const marks = [...new Map([...alerts].sort((a, b) => +(a.severity === "high") - +(b.severity === "high")).map((a) => [a.date, a])).values()].filter((a) => byDate.get(a.date)?.mean != null);
  const first = scenes[0], last = scenes[scenes.length - 1];
  const aria = `Série temporal do NDVI médio de ${label}${first && last ? `: de ${formatNdvi(first.mean)} em ${formatDate(first.date)} para ${formatNdvi(last.mean)} em ${formatDate(last.date)}` : ""}, com ${alerts.length} alertas`;
  return (
    <div role="img" aria-label={aria} data-testid="ndvi-chart" className="h-[210px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 22, right: 14, bottom: 0, left: -14 }} onClick={(s) => { const d = s?.activeLabel; if (typeof d === "string") onSelect?.(d); }}>
          <CartesianGrid stroke="#1f2a1c" strokeOpacity={0.1} vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fontSize: 11, fill: COR.mut }} interval="preserveStartEnd" minTickGap={18} />
          <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={formatNdvi} tick={{ fontSize: 11, fill: COR.mut }} width={46} />
          <Tooltip
            formatter={(v, n) => [Array.isArray(v) ? `${formatNdvi(v[0])} – ${formatNdvi(v[1])}` : formatNdvi(v as number), n === "band" ? "p10–p90" : "NDVI médio"]}
            labelFormatter={(d) => formatDate(String(d))}
            contentStyle={{ borderRadius: 10, border: "1px solid rgba(31,42,28,.16)", fontSize: 13 }}
          />
          <Area dataKey="band" stroke="none" fill={COR.folha} fillOpacity={0.18} isAnimationActive={false} connectNulls={false} />
          {date && <ReferenceLine x={date} stroke="#1f2a1c" strokeDasharray="3 3" />}
          <Line dataKey="mean" stroke={COR.folha} strokeWidth={2.6} dot={{ r: 3.2, fill: "#fff", stroke: COR.folha, strokeWidth: 2 }} activeDot={{ r: 6, fill: "#1f2a1c", stroke: COR.folha }} isAnimationActive={false} />
          {marks.map((a) => (
            <ReferenceDot key={a.id} x={a.date} y={byDate.get(a.date)!.mean!} ifOverflow="visible" shape={<Marker color={a.severity === "high" ? COR.alta : COR.media} />} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
