"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import type { PlotFeature, Scene } from "@/lib/api-types";
import { boundsToCoords } from "@/lib/geo";
import { formatDate } from "@/lib/format";
const sceneId = (date: string) => `ndvi-${date}`; // mesmo id de MapView (não importa MapView: maplibre não pode rodar no SSR)

/** Estado do modo comparar: A fica no mapa principal (esquerda), B no CompareMap (direita). */
export function useCompare(scenes: Scene[]) {
  const [on, setOn] = useState(false);
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  useEffect(() => {
    setA(scenes[0]?.date ?? null);
    setB(scenes[scenes.length - 1]?.date ?? null);
  }, [scenes]);
  const toggle = useCallback(() => setOn((v) => !v), []);
  return { on: on && scenes.length > 1, toggle, a, b, setA, setB };
}
export type CompareApi = ReturnType<typeof useCompare>;

export function CompareControls({ cmp, scenes }: { cmp: CompareApi; scenes: Scene[] }) {
  const sel = (label: string, v: string | null, set: (d: string) => void) => (
    <label className="grid gap-1 text-xs text-[#d6d1c0]">
      {label}
      <select
        value={v ?? ""}
        onChange={(e) => set(e.target.value)}
        className="min-h-11 w-full rounded-[10px] border border-solo/25 bg-solo/10 px-2.5 text-sm text-solo"
      >
        {scenes.map((s) => (
          <option key={s.date} value={s.date} className="text-tinta">
            {formatDate(s.date)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="pointer-events-auto grid grid-cols-2 gap-2.5 rounded-xl bg-tinta/85 p-3 text-solo shadow-lg backdrop-blur">
      {sel("Data A (esquerda)", cmp.a, cmp.setA)}
      {sel("Data B (direita)", cmp.b, cmp.setB)}
    </div>
  );
}

const clamp = (v: number) => Math.min(98, Math.max(2, v));

export default function CompareMap({ map, plots, scenes, a, b }: { map: MLMap; plots: PlotFeature[]; scenes: Scene[]; a: string | null; b: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);
  const [cmp, setCmp] = useState<MLMap | null>(null);

  useEffect(() => {
    let dead = false;
    let m: MLMap | undefined;
    let off = () => {};
    import("maplibre-gl").then(({ Map }) => {
      if (dead) return;
      const st = map.getStyle();
      m = new Map({
        container: box.current!,
        style: { version: 8, sources: { base: st.sources.base }, layers: st.layers.filter((l) => l.id === "base") },
        center: map.getCenter(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        attributionControl: false,
      });
      let lock = false;
      const link = (from: MLMap, to: MLMap) => () => {
        if (lock) return;
        lock = true;
        to.jumpTo({ center: from.getCenter(), zoom: from.getZoom(), bearing: from.getBearing(), pitch: from.getPitch() });
        lock = false;
      };
      const f = link(map, m);
      const g = link(m, map);
      map.on("move", f);
      m.on("move", g);
      off = () => map.off("move", f);
      setCmp(m);
    });
    return () => {
      dead = true;
      off();
      m?.remove();
      setCmp(null);
    };
  }, [map]);

  useEffect(() => {
    const s = scenes.find((x) => x.date === b);
    if (!cmp || !s) return;
    const id = sceneId(s.date);
    const add = () => {
      const data = { type: "FeatureCollection" as const, features: plots };
      cmp.addSource("plots", { type: "geojson", data });
      cmp.addSource(id, { type: "image", url: s.pngUrl, coordinates: boundsToCoords(s.bounds) });
      cmp.addLayer({ id, type: "raster", source: id, paint: { "raster-opacity": 0.8, "raster-resampling": "nearest" } });
      cmp.addLayer({ id: "plots-line", type: "line", source: "plots", paint: { "line-color": "#f4efe4", "line-width": 2 } });
    };
    cmp.isStyleLoaded() ? add() : cmp.once("load", add);
    return () => {
      try {
        ["plots-line", id].forEach((l) => cmp.getLayer(l) && cmp.removeLayer(l));
        ["plots", id].forEach((l) => cmp.getSource(l) && cmp.removeSource(l));
      } catch {} // mapa já removido
    };
  }, [cmp, b, scenes, plots]);

  const move = (x: number) => {
    const r = root.current!.getBoundingClientRect();
    setPct(clamp(((x - r.left) / r.width) * 100));
  };

  return (
    <div ref={root} className="pointer-events-none absolute inset-0 z-0" data-testid="compare" data-compare-a={a ?? ""} data-compare-b={b ?? ""} data-divider-pct={Math.round(pct)}>
      <div className="pointer-events-auto absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
        <div ref={box} className="absolute inset-0" />
      </div>
      <div className="absolute inset-y-0 w-0" style={{ left: `${pct}%` }}>
        <div className="absolute inset-y-0 -left-[1.5px] w-[3px] bg-white shadow-[0_0_0_1px_#0004]" />
        <button
          role="slider"
          aria-label="Divisor entre as datas A e B"
          aria-valuemin={2}
          aria-valuemax={98}
          aria-valuenow={Math.round(pct)}
          onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={(e) => e.buttons & 1 && move(e.clientX)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setPct((p) => clamp(p - 5));
            if (e.key === "ArrowRight") setPct((p) => clamp(p + 5));
          }}
          className="pointer-events-auto absolute -left-6 top-[40%] grid h-12 w-12 cursor-ew-resize touch-none place-items-center rounded-full border-[3px] border-white bg-tinta text-white shadow-lg focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#2f7de1]"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M8 7l-5 5 5 5zM16 7v10l5-5z" />
          </svg>
        </button>
        <span className="absolute right-3 top-[40%] mt-14 whitespace-nowrap rounded-full bg-tinta/85 px-3 py-1.5 text-[13px] font-semibold text-solo shadow">A · {a && formatDate(a)}</span>
        <span className="absolute left-3 top-[40%] mt-14 whitespace-nowrap rounded-full bg-folha px-3 py-1.5 text-[13px] font-semibold text-solo shadow">B · {b && formatDate(b)}</span>
      </div>
    </div>
  );
}
