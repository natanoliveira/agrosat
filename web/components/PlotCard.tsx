import { formatDate, formatHa, formatNdvi } from "@/lib/format";
import type { DashboardPlot } from "@/lib/api-types";

const TREND = {
  up: { s: "↑", t: "em alta", c: "text-folha" },
  down: { s: "↓", t: "em queda", c: "text-red-700" },
  flat: { s: "→", t: "estável", c: "text-tinta/60" },
} as const;

const ALERT = { drop: "Queda de NDVI", patch: "Mancha" } as const;

export default function PlotCard({ plot, onReprocess, busy }: { plot: DashboardPlot; onReprocess: () => void; busy: boolean }) {
  const tr = plot.trend ? TREND[plot.trend] : null;
  const a = plot.lastAlert;
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-tinta/20 bg-white/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-lg font-bold text-folha">{plot.name}</h2>
          <p className="text-sm text-tinta/70">{formatHa(plot.areaHa)}</p>
        </div>
        {plot.needsReprocess && (
          <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Reprocesse</span>
        )}
      </div>

      {plot.currentNdvi == null ? (
        <div className="rounded border border-dashed border-tinta/30 p-3 text-sm">
          <b>Sem cenas válidas</b>
          <p className="text-tinta/70">Nuvens ou sem imagens no período. Tentaremos de novo na próxima passagem do satélite.</p>
        </div>
      ) : (
        <div>
          <span className={`text-3xl font-bold tabular-nums ${plot.currentNdvi < 0.4 ? "text-red-700" : "text-tinta"}`}>{formatNdvi(plot.currentNdvi)}</span>
          {tr && <span className={`ml-2 text-lg font-semibold ${tr.c}`} aria-label={`tendência ${tr.t}`}>{tr.s}</span>}
          <p className="text-xs text-tinta/70">NDVI atual</p>
        </div>
      )}

      {plot.needsReprocess && (
        <div className="rounded border border-amber-400 bg-amber-50 p-2 text-sm">
          Geometria alterada, <b>reprocesse</b> para atualizar o NDVI.
          <button onClick={onReprocess} disabled={busy} className="ml-2 underline disabled:opacity-50">{busy ? "Enviando…" : "Reprocessar"}</button>
        </div>
      )}

      <p className="mt-auto text-sm text-tinta/70">
        {a ? (
          <>
            Último alerta:{" "}
            <b className={a.severity === "high" ? "text-red-700" : "text-barro"}>{ALERT[a.type]}</b> em {formatDate(a.date.slice(0, 10))}
          </>
        ) : (
          "sem alertas"
        )}
      </p>
    </li>
  );
}
