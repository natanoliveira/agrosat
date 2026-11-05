"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { PlotFeature } from "@/lib/api-types";

export default function ImportButton({ farmId, onImported }: { farmId: string; onImported: (p: PlotFeature[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const r = (await api.importPlots(farmId, file)) as { created: PlotFeature[]; ignored?: number };
      onImported(r.created);
      const ign = r.ignored ? `, ${r.ignored} ignorado(s)` : "";
      setMsg({ ok: true, text: `${r.created.length} talhão(ões) importado(s)${ign}.` });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <input ref={input} type="file" accept=".geojson,.json,.kml" onChange={onFile} className="hidden" data-testid="import-input" />
      <button
        onClick={() => input.current?.click()} disabled={busy}
        className="min-h-[44px] rounded bg-solo/95 px-3 py-2 text-sm font-medium shadow hover:text-folha disabled:opacity-60"
      >
        {busy ? "Importando…" : "Importar GeoJSON/KML"}
      </button>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`max-w-xs rounded px-3 py-1.5 text-sm shadow ${msg.ok ? "bg-folha text-solo" : "bg-barro text-solo"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
