"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { Map as MLMap } from "maplibre-gl";
import ImportButton from "@/components/map/ImportButton";
import type { Bounds, PlotFeature, Scene } from "@/lib/api-types";
import Timeline, { useTimeline } from "@/components/timeline/Timeline";
import { plotsBounds } from "@/lib/geo";
import SidePanel from "@/components/panel/SidePanel";
import CompareMap, { CompareControls, useCompare } from "@/components/map/CompareMap";
import PixelPopup from "@/components/map/PixelPopup";
import Legend from "@/components/map/Legend";
import ProcessButton from "@/components/panel/ProcessButton";
import ZonesLayer from "@/components/map/ZonesLayer";

const DrawControlDyn = dynamic(() => import("@/components/map/DrawControl"), { ssr: false });
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-tinta/80" />,
});

export default function FarmMapPage() {
  const { id } = useParams<{ id: string }>();
  const [plots, setPlots] = useState<PlotFeature[]>([]);
  const [map, setMap] = useState<MLMap | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [plotId, setPlotId] = useState<string | null>(null);
  const [allScenes, setAllScenes] = useState<Scene[] | null>(null);
  const [reproc, setReproc] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.listPlots(id).then(setPlots).catch((e: Error) => setErro(e.message));
  }, [id]);

  const plot = plots.find((p) => p.properties.id === plotId) ?? plots[0];
  const selId = plot?.properties.id;

  useEffect(() => {
    if (!selId) return;
    setAllScenes(null);
    setReproc(false);
    api.scenes(selId).then(setAllScenes).catch((e: Error) => { setAllScenes([]); setErro(e.message); });
  }, [selId, reload]);

  const valid = useMemo(() => (allScenes ?? []).filter((s) => s.valid), [allScenes]);
  // ponto de extensão: compare/painel/zonas/alertas consomem `tl` (scene, date, setDate) e `map`
  const tl = useTimeline(valid);
  const semCenas = allScenes !== null && valid.length === 0;
  const cmp = useCompare(valid);
  const [zonesOn, setZonesOn] = useState(false);
  const toolBtn = (on: boolean) => `pointer-events-auto min-h-9 rounded-full px-3 text-sm font-medium shadow ${on ? "bg-folha text-solo" : "bg-solo/95 hover:text-folha"}`;

  // deep link de "ver no mapa": ?plot=&date=&bbox=w,s,e,n
  const deep = useRef<{ plot: string; date: string | null; bbox: Bounds | null } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const plot = q.get("plot");
    if (!plot) return;
    const n = (q.get("bbox") ?? "").split(",").map(Number);
    deep.current = { plot, date: q.get("date"), bbox: n.length === 4 && n.every(Number.isFinite) ? [[n[0], n[1]], [n[2], n[3]]] : null };
    setPlotId(plot);
  }, []);
  useEffect(() => {
    const d = deep.current;
    if (!d || allScenes === null || selId !== d.plot) return;
    if (d.date) tl.setDate(d.date);
    if (!map) return;
    const b = d.bbox ?? plotsBounds(plots.filter((p) => p.properties.id === d.plot));
    if (b) map.fitBounds(b, { padding: 80, maxZoom: 17, duration: 600 });
    deep.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allScenes, selId, map]);

  const pick = (pid: string) => {
    setPlotId(pid);
    const b = plotsBounds(plots.filter((p) => p.properties.id === pid));
    if (b && map) map.fitBounds(b, { padding: 60, maxZoom: 17, duration: 600 });
  };

  return (
    <div className="relative h-[calc(100vh-117px)] bg-tinta">
      <MapView plots={plots} onMap={setMap} scenes={valid} date={zonesOn ? null : cmp.on ? cmp.a : tl.date} />
      {map && cmp.on && <CompareMap map={map} plots={plots} scenes={valid} a={cmp.a} b={cmp.b} />}
      {map && selId && tl.date && !cmp.on && !zonesOn && <PixelPopup map={map} plotId={selId} date={tl.date} />}
      {valid.length > 0 && !cmp.on && <Legend mode={zonesOn ? "zones" : "ndvi"} />}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2">
        <Link href="/" className="pointer-events-auto w-fit rounded bg-solo/95 px-3 py-1.5 text-sm font-medium shadow hover:text-folha">
          ← Fazendas
        </Link>
        {valid.length > 0 && (
          <div role="group" aria-label="Camadas" className="flex gap-1.5">
            <button aria-pressed={cmp.on} disabled={valid.length < 2} onClick={() => { setZonesOn(false); cmp.toggle(); }} className={`${toolBtn(cmp.on)} disabled:opacity-60`}>
              Comparar
            </button>
            <button aria-pressed={zonesOn} onClick={() => { if (cmp.on) cmp.toggle(); setZonesOn((v) => !v); }} className={toolBtn(zonesOn)}>
              Zonas
            </button>
          </div>
        )}
        {plots.length > 1 && (
          <div role="group" aria-label="Talhão" className="pointer-events-auto flex max-w-[70vw] flex-wrap gap-1.5">
            {plots.map((p) => (
              <button
                key={p.properties.id}
                aria-pressed={p.properties.id === selId}
                onClick={() => pick(p.properties.id)}
                className={`rounded-full px-3 py-1 text-sm shadow ${p.properties.id === selId ? "bg-folha text-solo" : "bg-solo/95 hover:text-folha"}`}
              >
                {p.properties.name}
              </button>
            ))}
          </div>
        )}
        {plot?.properties.needsReprocess && (
          <p role="status" className="pointer-events-auto flex max-w-xs items-center gap-2 rounded bg-barro px-3 py-1.5 text-sm text-solo shadow">
            <span>Geometria alterada, reprocesse.</span>
            <button
              disabled={reproc}
              onClick={() => api.processPlot(plot.properties.id).then(() => setReproc(true)).catch((e: Error) => setErro(e.message))}
              className="rounded bg-solo px-2 py-0.5 font-medium text-tinta disabled:opacity-60"
            >
              {reproc ? "Em fila…" : "Reprocessar"}
            </button>
          </p>
        )}
        {erro && (
          <p role="alert" className="max-w-xs rounded bg-barro px-3 py-1.5 text-sm text-solo shadow">
            Talhões indisponíveis: {erro}
          </p>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-56 left-4 right-14 flex flex-col items-start gap-2 sm:bottom-auto sm:left-auto sm:right-[26.5rem] sm:top-4 sm:items-end">
        {map && <DrawControlDyn map={map} farmId={id} onCreated={(p) => setPlots((a) => [...a, p])} />}
        <ImportButton farmId={id} onImported={(n) => setPlots((a) => [...a, ...n])} />
      </div>
      <div className="pointer-events-none absolute inset-x-3 bottom-20 sm:bottom-3 sm:right-auto sm:w-[28rem]">
        {semCenas && (
          <div role="status" className="pointer-events-auto flex flex-col items-start gap-2 rounded-xl bg-tinta/85 px-4 py-3 text-sm text-solo shadow-lg">
            <p>Sem cenas válidas no período.</p>
            {selId && <ProcessButton plotId={selId} onDone={() => setReload((n) => n + 1)} />}
          </div>
        )}
        {cmp.on ? (
          <CompareControls cmp={cmp} scenes={valid} />
        ) : zonesOn && map && selId && plot ? (
          <ZonesLayer map={map} plotId={selId} plotName={plot.properties.name} scenes={valid} />
        ) : (
          <Timeline tl={tl} total={valid.length} />
        )}
      </div>
      <SidePanel plot={plot} scenes={valid} tl={tl} />
    </div>
  );
}
