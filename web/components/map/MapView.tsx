"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PlotFeature, Scene } from "@/lib/api-types";
import { boundsToCoords, plotsBounds } from "@/lib/geo";

export const sceneId = (date: string) => `ndvi-${date}`;
const OVERLAY_OPACITY = 0.8;

const BASEMAP_URL =
  process.env.NEXT_PUBLIC_BASEMAP_URL ??
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ATTRIBUTION = "Tiles © Esri — Maxar, Earthstar Geographics, GIS User Community";

type Props = {
  plots?: PlotFeature[];
  onMap?: (m: maplibregl.Map | null) => void;
  /** cenas válidas do talhão; uma camada raster por cena, só a de `date` fica visível */
  scenes?: Scene[];
  date?: string | null;
};

export default function MapView({ plots = [], onMap, scenes, date }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: el.current!,
      center: [-52, -14],
      zoom: 3.6,
      attributionControl: { compact: true },
      style: {
        version: 8,
        sources: { base: { type: "raster", tiles: [BASEMAP_URL], tileSize: 256, maxzoom: 19, attribution: ATTRIBUTION } },
        layers: [{ id: "base", type: "raster", source: "base" }],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    map.on("idle", () => setReady(true));
    mapRef.current = map;
    if (process.env.NEXT_PUBLIC_E2E === "1") (window as unknown as { __map?: unknown }).__map = map; // gancho para o e2e posicionar/projetar
    onMap?.(map);
    return () => {
      onMap?.(null);
      mapRef.current = null;
      map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const data = { type: "FeatureCollection" as const, features: plots };
    const apply = () => {
      const src = map.getSource("plots") as maplibregl.GeoJSONSource | undefined;
      if (src) return src.setData(data);
      map.addSource("plots", { type: "geojson", data });
      map.addLayer({ id: "plots-fill", type: "fill", source: "plots", paint: { "fill-color": "#e8d9a8", "fill-opacity": 0.15 } });
      map.addLayer({ id: "plots-line", type: "line", source: "plots", paint: { "line-color": "#f4efe4", "line-width": 2 } });
    };
    map.isStyleLoaded() ? apply() : map.once("load", apply);
    const b = plotsBounds(plots);
    if (b) map.fitBounds(b, { padding: 60, maxZoom: 17, duration: 0 });
  }, [plots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !scenes?.length) return;
    scenes.forEach((s) => { new Image().src = s.pngUrl; }); // pré-carrega no cache do browser
    const add = () => {
      scenes.forEach((s) => {
        const id = sceneId(s.date);
        if (map.getSource(id)) return;
        map.addSource(id, { type: "image", url: s.pngUrl, coordinates: boundsToCoords(s.bounds) });
        map.addLayer(
          { id, type: "raster", source: id, paint: { "raster-opacity": 0, "raster-resampling": "nearest" } },
          map.getLayer("plots-fill") ? "plots-fill" : undefined,
        );
      });
      show();
    };
    const show = () => scenes.forEach((s) => map.getLayer(sceneId(s.date)) && map.setPaintProperty(sceneId(s.date), "raster-opacity", s.date === dateRef.current ? OVERLAY_OPACITY : 0));
    showRef.current = show;
    map.isStyleLoaded() ? add() : map.once("load", add);
    return () => {
      showRef.current = () => {};
      if (mapRef.current !== map) return;
      scenes.forEach((s) => {
        const id = sceneId(s.date);
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
      });
    };
  }, [scenes]);

  const dateRef = useRef(date);
  const showRef = useRef<() => void>(() => {});
  useEffect(() => {
    dateRef.current = date;
    showRef.current();
  }, [date]);

  return <div ref={el} data-map-ready={ready} data-overlay-date={date ?? ""} className="h-full w-full" />;
}
