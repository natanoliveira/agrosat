"use client";
import { useEffect, useMemo, useState } from "react";
import type { Map as MLMap } from "maplibre-gl";
import { api, ApiRequestError } from "@/lib/api";
import type { Scene, ZoneClass, Zones } from "@/lib/api-types";
import { formatDate, formatHa } from "@/lib/format";
import { ZONE_STYLE } from "./Legend";

const ORDER: ZoneClass[] = ["high", "medium", "low"];
const match = (f: (c: ZoneClass) => string) => ["match", ["get", "class"], "low", f("low"), "medium", f("medium"), f("high")] as never;

/** Camada de zonas (RF-14/25) + seletor de data + download GeoJSON (RF-15). Monte só quando a camada estiver ativa. */
export default function ZonesLayer({ map, plotId, plotName, scenes }: { map: MLMap; plotId: string; plotName: string; scenes: Scene[] }) {
  const last = scenes[scenes.length - 1]?.date ?? "";
  const [date, setDate] = useState(last);
  const [zones, setZones] = useState<Zones | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setDate(last), [last, plotId]);

  useEffect(() => {
    if (!date) return;
    let alive = true;
    setZones(null);
    setErro(null);
    api
      .zones(plotId, date)
      .then((z) => alive && setZones(z))
      .catch((e: Error) => alive && setErro(e instanceof ApiRequestError && e.status === 404 ? "Sem zonas para esta data." : e.message));
    return () => void (alive = false);
  }, [plotId, date]);

  useEffect(() => {
    if (!zones) return;
    const data = zones as never;
    const before = map.getLayer("plots-fill") ? "plots-fill" : undefined;
    map.addSource("zones", { type: "geojson", data });
    map.addLayer({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": match((c) => ZONE_STYLE[c].color), "fill-opacity": 0.72 } }, before);
    // borda escura em todas as classes: o amarelo (médio) não some sobre a imagem de satélite
    map.addLayer({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": "#1f2a1c", "line-width": match((c) => (c === "medium" ? "2.5" : "1.5")) as never } }, before);
    return () => {
      ["zones-line", "zones-fill"].forEach((l) => map.getLayer(l) && map.removeLayer(l));
      map.getSource("zones") && map.removeSource("zones");
    };
  }, [map, zones]);

  const area = useMemo(() => {
    const a: Record<ZoneClass, number> = { low: 0, medium: 0, high: 0 };
    zones?.features.forEach((f) => (a[f.properties.class] += f.properties.areaHa));
    return a;
  }, [zones]);

  const download = () => {
    if (!zones) return;
    const slug = plotName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(zones)], { type: "application/geo+json" }));
    a.download = `zonas-${slug}-${date}.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  };

  return (
    <div data-testid="zones-panel" data-zones-date={date} className="pointer-events-auto grid gap-2.5 rounded-xl bg-tinta/85 p-3 text-solo shadow-lg backdrop-blur">
      <label className="grid gap-1 text-xs text-[#d6d1c0]">
        Data das zonas
        <select value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data das zonas" className="min-h-11 w-full rounded-[10px] border border-solo/25 bg-solo/10 px-2.5 text-sm text-solo">
          {scenes.map((s) => (
            <option key={s.date} value={s.date} className="text-tinta">
              {formatDate(s.date)}
              {s.date === last ? " (última válida)" : ""}
            </option>
          ))}
        </select>
      </label>
      {erro ? (
        <p role="status" className="text-sm">{erro}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 text-xs">
          {ORDER.map((c) => (
            <li key={c} className="flex items-center gap-1.5">
              <i className="h-4 w-4 shrink-0 rounded border-2 border-tinta ring-1 ring-solo" style={{ background: ZONE_STYLE[c].color }} />
              <span>
                <b className="block text-[13px]">{ZONE_STYLE[c].label}</b>
                <span className="tabular-nums text-[#d6d1c0]">{zones ? formatHa(area[c]) : "…"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={download}
        disabled={!zones}
        className="min-h-11 rounded bg-[#a7d27a] px-4 text-sm font-semibold text-tinta disabled:opacity-60 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#2f7de1]"
      >
        Baixar GeoJSON das zonas
      </button>
    </div>
  );
}
