"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import PlotCard from "@/components/PlotCard";
import { api } from "@/lib/api";
import type { Dashboard } from "@/lib/api-types";

export default function FarmDashboard() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.dashboard(id).then(setData).catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  async function reprocess() {
    setBusy(true);
    try {
      await api.processFarm(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-folha pb-3">
        <div>
          <Link href="/" className="text-sm text-tinta/70 hover:text-folha">← Fazendas</Link>
          <h1 className="font-serif text-3xl font-bold">{data?.farm.name ?? "Carregando…"}</h1>
          {data && <p className="text-sm text-barro">{data.farm.municipality} / {data.farm.state} · {data.plots.length} talhão(ões)</p>}
        </div>
        <Link href={`/farms/${id}/map`} className="rounded bg-folha px-4 py-2 text-sm font-semibold text-solo">Abrir mapa</Link>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded border border-red-700/40 bg-red-50 p-3 text-sm text-red-800">
          {error} <button onClick={load} className="ml-2 underline">Tentar novamente</button>
        </p>
      )}
      {data?.plots.length === 0 && <p className="rounded border border-dashed border-tinta/30 p-8 text-center">Nenhum talhão ainda. Desenhe ou importe no mapa.</p>}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.plots.map((p) => <PlotCard key={p.id} plot={p} onReprocess={reprocess} busy={busy} />)}
      </ul>
    </div>
  );
}
