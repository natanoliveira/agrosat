"use client";
import { useEffect, useState } from "react";
import type { Map as MLMap, MapMouseEvent } from "maplibre-gl";
import { api } from "@/lib/api";
import { formatDate, formatNdvi } from "@/lib/format";

type Hit = { lng: number; lat: number; ndvi: number | null | undefined; loading?: boolean };

/** Clique no mapa -> "NDVI: 0,72" ou "sem dado" (RF-24). */
export default function PixelPopup({ map, plotId, date }: { map: MLMap; plotId: string; date: string }) {
  const [hit, setHit] = useState<Hit | null>(null);
  const [xy, setXy] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let seq = 0;
    const onClick = (e: MapMouseEvent) => {
      const { lng, lat } = e.lngLat;
      const n = ++seq;
      setHit({ lng, lat, ndvi: undefined, loading: true });
      api
        .pixel(plotId, date, lng, lat)
        .then((r) => n === seq && setHit({ lng, lat, ndvi: r.ndvi }))
        .catch(() => n === seq && setHit({ lng, lat, ndvi: null }));
    };
    map.on("click", onClick);
    return () => {
      seq++;
      map.off("click", onClick);
      setHit(null);
    };
  }, [map, plotId, date]);

  useEffect(() => {
    if (!hit) return setXy(null);
    const place = () => {
      const p = map.project([hit.lng, hit.lat]);
      setXy({ x: p.x, y: p.y });
    };
    place();
    map.on("move", place);
    return () => void map.off("move", place);
  }, [map, hit?.lng, hit?.lat, !!hit]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!hit || !xy || hit.loading) return null;
  const ok = hit.ndvi != null;
  const w = map.getContainer().clientWidth;
  return (
    <div
      role="dialog"
      aria-label="Valor do pixel"
      data-testid="pixel-popup"
      className="pointer-events-auto absolute z-20 min-w-[110px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-xl bg-solo px-3 py-2 text-[13px] text-tinta shadow-xl"
      style={{ left: Math.min(Math.max(xy.x, 70), w - 70), top: xy.y }}
    >
      <button
        onClick={() => setHit(null)}
        aria-label="Fechar"
        className="absolute -right-2.5 -top-2.5 grid h-7 w-7 place-items-center rounded-full bg-tinta text-base leading-none text-white"
      >
        ×
      </button>
      <b className={`block font-serif tabular-nums ${ok ? "text-lg" : "text-base text-[#56604f]"}`}>
        {ok ? `NDVI: ${formatNdvi(hit.ndvi)}` : "sem dado"}
      </b>
      <span className="tabular-nums">{formatDate(date)}</span>
      <span aria-hidden className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-solo" />
    </div>
  );
}
