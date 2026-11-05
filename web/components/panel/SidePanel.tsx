"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import NdviChart from "@/components/charts/NdviChart";
import ReportButton from "@/components/panel/ReportButton";
import { api } from "@/lib/api";
import type { Alert, PlotFeature, Scene } from "@/lib/api-types";
import { formatNdvi, formatPct } from "@/lib/format";
import type { TimelineApi } from "@/components/timeline/Timeline";

/** Desktop (sm+): painel lateral à direita. Celular: bottom sheet recolhível. */
export default function SidePanel({ plot, scenes, tl }: { plot?: PlotFeature; scenes: Scene[]; tl: TimelineApi }) {
  const [open, setOpen] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const id = plot?.properties.id;

  useEffect(() => { if (window.innerWidth < 640) setOpen(false); }, []);
  useEffect(() => {
    if (!id) return;
    setAlerts([]);
    api.alerts({ plotId: id, pageSize: 100 }).then((r) => setAlerts(r.data)).catch(() => setAlerts([]));
  }, [id]);

  if (!plot) return null;
  const s = tl.scene;
  return (
    <aside
      aria-label="Painel do talhão"
      data-sheet={open ? "open" : "closed"}
      className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-[22px] bg-solo text-tinta shadow-[0_-10px_30px_#0006] transition-[height] duration-200 sm:inset-y-0 sm:left-auto sm:h-auto sm:w-[392px] sm:rounded-none sm:border-l sm:border-tinta/15 sm:shadow-none ${open ? "h-[46%]" : "h-16"}`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Expandir ou recolher painel"
        className="flex h-16 w-full flex-none flex-col items-center justify-center gap-1 sm:hidden"
      >
        <span className="h-1.5 w-11 rounded-full bg-tinta/30" />
        <span className="font-serif text-base font-bold">NDVI de {plot.properties.name}</span>
      </button>
      <div className={`min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:block sm:pt-4 ${open ? "" : "hidden"}`}>
        <h3 className="hidden font-serif text-xl font-bold sm:block">NDVI de {plot.properties.name}</h3>
        <p className="mb-3 text-sm text-tinta/70">Média, faixa p10–p90 e alertas por data. Toque num ponto para ir à cena.</p>
        {scenes.length === 0 ? (
          <p role="status" className="rounded-xl border border-tinta/15 bg-white p-4 text-sm">Nenhuma cena válida para exibir.</p>
        ) : (
          <>
            {s && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                <Kpi l="Média" v={formatNdvi(s.mean)} />
                <Kpi l="p10 · p90" v={`${formatNdvi(s.p10)} · ${formatNdvi(s.p90)}`} small />
                <Kpi l="Área válida" v={formatPct(s.validPct)} />
              </div>
            )}
            <div className="rounded-2xl border border-tinta/15 bg-white px-1 pb-1 pt-2">
              <NdviChart scenes={scenes} alerts={alerts} date={tl.date} onSelect={tl.setDate} label={plot.properties.name} />
            </div>
            <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-tinta/70">
              <li><i className="mr-1.5 inline-block h-[3px] w-[18px] align-middle bg-folha" />Média</li>
              <li><i className="mr-1.5 inline-block h-2.5 w-[18px] align-middle bg-folha/20" />p10–p90</li>
              <li><span className="mr-1 text-barro">▲</span>Alerta</li>
            </ul>
          </>
        )}
        <ReportButton plotId={plot.properties.id} />
        <Link href={`/alerts?plotId=${id}`} className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-folha underline underline-offset-4">
          Ver alertas deste talhão ({alerts.length})
        </Link>
      </div>
    </aside>
  );
}

function Kpi({ l, v, small }: { l: string; v: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-tinta/15 bg-white px-2.5 py-2">
      <small className="block text-xs text-tinta/70">{l}</small>
      <b className={`block whitespace-nowrap font-serif tabular-nums ${small ? "text-[15px] leading-[1.7]" : "text-xl"}`}>{v}</b>
    </div>
  );
}
