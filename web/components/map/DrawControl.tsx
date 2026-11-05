"use client";
import { useEffect, useRef, useState } from "react";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import type { Map } from "maplibre-gl";
import type { Polygon } from "geojson";
import { api } from "@/lib/api";
import type { PlotFeature } from "@/lib/api-types";

// ponytail: mapbox-gl-draw funciona com maplibre-gl 4 trocando as classes CSS e usando estilos próprios (sem expressões incompatíveis)
const COLOR = "#e8a33d";
const STYLES = [
  { id: "poly-fill", type: "fill", filter: ["all", ["==", "$type", "Polygon"]], paint: { "fill-color": COLOR, "fill-opacity": 0.25 } },
  { id: "poly-line", type: "line", filter: ["all", ["==", "$type", "Polygon"]], layout: { "line-join": "round" }, paint: { "line-color": COLOR, "line-width": 3 } },
  { id: "line", type: "line", filter: ["all", ["==", "$type", "LineString"]], paint: { "line-color": COLOR, "line-width": 3 } },
  { id: "vertex-halo", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"]], paint: { "circle-radius": 7, "circle-color": "#fff" } },
  { id: "vertex", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "vertex"]], paint: { "circle-radius": 5, "circle-color": COLOR } },
  { id: "midpoint", type: "circle", filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]], paint: { "circle-radius": 3, "circle-color": "#fff" } },
];

export default function DrawControl({ map, farmId, onCreated }: { map: Map; farmId: string; onCreated: (p: PlotFeature) => void }) {
  const draw = useRef<MapboxDraw | null>(null);
  const [mode, setMode] = useState<"idle" | "drawing" | "naming">("idle");
  const [geom, setGeom] = useState<Polygon | null>(null);
  const [name, setName] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const c = MapboxDraw.constants.classes as Record<string, string>;
    Object.keys(c).forEach((k) => (c[k] = c[k].replace("mapboxgl", "maplibregl")));
    const d = new MapboxDraw({ displayControlsDefault: false, styles: STYLES as never });
    draw.current = d;
    map.addControl(d as never);
    const onCreate = (e: { features: { geometry: Polygon }[] }) => {
      setGeom(e.features[0].geometry);
      setMode("naming");
    };
    map.on("draw.create", onCreate as never);
    return () => {
      map.off("draw.create", onCreate as never);
      if (map.getStyle()) map.removeControl(d as never);
    };
  }, [map]);

  const reset = () => {
    draw.current?.deleteAll();
    setMode("idle"); setGeom(null); setName(""); setErro(null);
  };

  const start = () => {
    draw.current?.deleteAll();
    draw.current?.changeMode("draw_polygon");
    setErro(null);
    setMode("drawing");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geom) return;
    setSaving(true); setErro(null);
    try {
      onCreated(await api.createPlot(farmId, { name: name.trim(), geometry: geom }));
      reset();
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const btn = "pointer-events-auto rounded px-3 py-2 text-sm font-medium shadow min-h-[44px]";
  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      {mode === "idle" && (
        <button onClick={start} className={`${btn} bg-folha text-solo hover:bg-folha/90`}>
          + Desenhar talhão
        </button>
      )}
      {mode === "drawing" && (
        <div className="flex max-w-xs items-center gap-2 rounded bg-solo/95 p-2 text-sm shadow">
          <span>Toque nos pontos do talhão; duplo toque finaliza.</span>
          <button onClick={reset} className="rounded border border-tinta/30 px-2 py-1">Cancelar</button>
        </div>
      )}
      {mode === "naming" && (
        <form onSubmit={save} className="flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded bg-solo/95 p-3 shadow">
          <label className="text-sm font-medium" htmlFor="plot-name">Nome do talhão</label>
          <input
            id="plot-name" autoFocus required maxLength={80} value={name} onChange={(e) => setName(e.target.value)}
            className="min-h-[44px] rounded border border-tinta/30 bg-white px-2 text-base"
          />
          {erro && <p role="alert" className="rounded bg-barro px-2 py-1 text-sm text-solo">{erro}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !name.trim()} className={`${btn} flex-1 bg-folha text-solo disabled:opacity-50`}>
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={reset} className={`${btn} border border-tinta/30 bg-white`}>Descartar</button>
          </div>
        </form>
      )}
    </div>
  );
}
