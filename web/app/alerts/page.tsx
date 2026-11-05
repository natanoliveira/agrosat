"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Alert, Paginated, Severity } from "@/lib/api-types";
import { formatDate, formatHa, formatPct } from "@/lib/format";
import { geometryBbox } from "@/lib/geo";

const PAGE_SIZE = 10;
const FILTROS: [Severity | undefined, string][] = [[undefined, "Todas"], ["high", "Alta"], ["medium", "Média"]];

const mapHref = (a: Alert, farmId: string) => {
  const bb = geometryBbox(a.geometry);
  const q = new URLSearchParams({ plot: a.plotId, date: a.date });
  if (bb) q.set("bbox", bb.flat().join(","));
  return `/farms/${farmId}/map?${q}`;
};

export default function AlertsPage() {
  const [sev, setSev] = useState<Severity>();
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Paginated<Alert> | null>(null);
  const [farms, setFarms] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [plotId, setPlotId] = useState<string>();

  useEffect(() => { setPlotId(new URLSearchParams(location.search).get("plotId") ?? undefined); }, []);

  useEffect(() => {
    setErro(null);
    api.alerts({ severity: sev, plotId, page, pageSize: PAGE_SIZE }).then(setRes).catch((e: Error) => setErro(e.message));
  }, [sev, page, plotId]);

  // alerta não traz farmId: resolve talhão -> fazenda pelas fazendas listadas
  useEffect(() => {
    api.listFarms(1, 100).then(async (f) => {
      const m: Record<string, string> = {};
      await Promise.all(f.data.map((x) => api.listPlots(x.id).then((ps) => ps.forEach((p) => (m[p.properties.id] = x.id))).catch(() => {})));
      setFarms(m);
    }).catch(() => {});
  }, []);

  const pages = res ? Math.max(1, Math.ceil(res.meta.total / res.meta.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="font-serif text-2xl font-bold">Alertas</h1>
      <p className="mb-4 mt-1 text-sm text-tinta/70">Queda de NDVI sobre as cenas anteriores ou mancha abaixo do p10 histórico.</p>
      <div role="group" aria-label="Filtrar severidade" className="mb-4 flex flex-wrap gap-1.5">
        {FILTROS.map(([k, l]) => (
          <button key={l} aria-pressed={sev === k} onClick={() => { setSev(k); setPage(1); }}
            className={`min-h-[44px] rounded-full border px-4 text-sm ${sev === k ? "border-tinta bg-tinta text-solo" : "border-tinta/15 bg-white"}`}>{l}</button>
        ))}
      </div>
      {erro && <p role="alert" className="rounded bg-barro px-3 py-2 text-sm text-solo">Alertas indisponíveis: {erro}</p>}
      {res === null && !erro && <p role="status" className="text-sm text-tinta/70">Carregando…</p>}
      {res?.data.length === 0 && <p role="status" className="rounded-xl border border-tinta/15 bg-white p-4 text-sm">Nenhum alerta com esse filtro.</p>}
      <ul className="grid gap-2.5">
        {res?.data.map((a) => {
          const alta = a.severity === "high";
          const farmId = farms[a.plotId];
          return (
            <li key={a.id} data-severity={a.severity} className={`rounded-xl border bg-white p-3 ${alta ? "border-[#a8321f77]" : "border-barro/40"}`}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${alta ? "bg-[#a8321f1c] text-[#a8321f]" : "bg-barro/10 text-barro"}`}>
                  {alta ? "▲ Severidade alta" : "▲ Severidade média"}
                </span>
                <span className="text-sm tabular-nums text-tinta/70">{formatDate(a.date)}</span>
              </div>
              <p className="mb-2.5 text-sm">
                <b>{a.plotName}</b> — {a.type === "drop"
                  ? <>queda de <b className="tabular-nums">{formatPct(a.value)}</b> no NDVI médio.</>
                  : <>mancha de <b className="tabular-nums">{formatHa(a.value)}</b> abaixo do p10 histórico.</>}
              </p>
              {farmId ? (
                <Link href={mapHref(a, farmId)} className="inline-flex min-h-[44px] items-center rounded-lg border border-tinta/25 px-3 text-sm font-medium hover:text-folha">
                  Ver no mapa
                </Link>
              ) : (
                <span className="text-sm text-tinta/60">Localizando fazenda…</span>
              )}
            </li>
          );
        })}
      </ul>
      {res && pages > 1 && (
        <nav aria-label="Paginação" className="mt-4 flex items-center justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="min-h-[44px] rounded-lg border border-tinta/25 px-4 disabled:opacity-50">Anterior</button>
          <span>Página {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="min-h-[44px] rounded-lg border border-tinta/25 px-4 disabled:opacity-50">Próxima</button>
        </nav>
      )}
    </div>
  );
}
