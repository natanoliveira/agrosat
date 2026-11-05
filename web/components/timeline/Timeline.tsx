"use client";
import { useCallback, useEffect, useState } from "react";
import type { Scene } from "@/lib/api-types";
import { formatDate, formatPct } from "@/lib/format";

export const PLAY_INTERVAL_MS = 900;

/** Estado da timeline sobre cenas válidas (asc). Ponto de extensão: compare/painel/zonas usam `scene`/`date`/`setDate`. */
export function useTimeline(scenes: Scene[]) {
  const [index, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = scenes.length - 1;

  useEffect(() => {
    setPlaying(false);
    setIdx(Math.max(last, 0));
  }, [scenes, last]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => Math.min(i + 1, last)), PLAY_INTERVAL_MS);
    return () => clearInterval(t);
  }, [playing, last]);

  useEffect(() => {
    if (playing && index >= last) setPlaying(false);
  }, [playing, index, last]);

  const toggle = useCallback(() => {
    if (!playing && index >= last) setIdx(0);
    setPlaying((p) => !p);
  }, [playing, index, last]);

  const setIndex = useCallback((i: number) => {
    setPlaying(false);
    setIdx(i);
  }, []);
  const setDate = useCallback(
    (d: string) => {
      const i = scenes.findIndex((s) => s.date === d);
      if (i >= 0) setIndex(i);
    },
    [scenes, setIndex],
  );
  const scene = scenes[index] ?? null;
  return { scene, date: scene?.date ?? null, index, setIndex, setDate, playing, toggle };
}

export type TimelineApi = ReturnType<typeof useTimeline>;

export default function Timeline({ tl, total, markedDates = [] }: { tl: TimelineApi; total: number; markedDates?: string[] }) {
  const { scene, index, playing, toggle, setIndex } = tl;
  if (!scene) return null;
  return (
    <div
      data-current-date={scene.date}
      data-playing={playing}
      className="pointer-events-auto grid grid-cols-[auto_1fr] items-center gap-x-3.5 rounded-xl bg-tinta/85 p-3 text-solo shadow-lg backdrop-blur"
    >
      <button
        onClick={toggle}
        aria-label={playing ? "Pausar animação" : `Reproduzir animação das ${total} datas`}
        className="grid h-12 w-12 place-items-center rounded-full bg-[#a7d27a] text-tinta transition-transform active:scale-95 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#2f7de1]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-serif text-xl font-bold tabular-nums">{formatDate(scene.date)}</span>
          <span className="text-xs text-[#d6d1c0] tabular-nums">
            Cena {index + 1} de {total} · cobertura {formatPct(scene.validPct)}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={total - 1}
          step={1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-label="Data da cena"
          aria-valuetext={formatDate(scene.date)}
          className="h-8 w-full accent-[#a7d27a]"
        />
        {markedDates.length > 0 && <p className="sr-only">Datas com alerta: {markedDates.map(formatDate).join(", ")}</p>}
      </div>
    </div>
  );
}
