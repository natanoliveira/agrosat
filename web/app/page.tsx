"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import FarmForm from "@/components/FarmForm";
import { api } from "@/lib/api";
import type { Farm, Paginated } from "@/lib/api-types";

const PAGE_SIZE = 12;

export default function Home() {
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<Paginated<Farm> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Farm | "new" | null>(null);
  const [deleting, setDeleting] = useState<Farm | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setRes(await api.listFarms(page, PAGE_SIZE));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function remove(f: Farm) {
    try {
      await api.deleteFarm(f.id);
      setDeleting(null);
      if (res && res.data.length === 1 && page > 1) setPage(page - 1);
      else load();
    } catch (e) {
      setDeleting(null);
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    }
  }

  const pages = res ? Math.max(1, Math.ceil(res.meta.total / res.meta.pageSize)) : 1;
  const done = () => { setEditing(null); load(); };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b-2 border-folha pb-3">
        <div>
          <h1 className="font-serif text-3xl font-bold">Fazendas</h1>
          <p className="text-sm text-tinta/70">{res ? `${res.meta.total} cadastrada(s)` : "Carregando…"}</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing("new")} className="rounded bg-folha px-4 py-2 text-sm font-semibold text-solo">
            + Nova fazenda
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6">
          <FarmForm key={editing === "new" ? "new" : editing.id} farm={editing === "new" ? undefined : editing} onSaved={done} onCancel={() => setEditing(null)} />
        </div>
      )}

      {error && (
        <p role="alert" className="mb-4 rounded border border-red-700/40 bg-red-50 p-3 text-sm text-red-800">
          {error} <button onClick={load} className="ml-2 underline">Tentar novamente</button>
        </p>
      )}

      {res && res.data.length === 0 && !error && (
        <p className="rounded border border-dashed border-tinta/30 p-8 text-center">Nenhuma fazenda ainda. Cadastre a primeira.</p>
      )}

      <ul className="grid gap-4 sm:grid-cols-2">
        {res?.data.map((f) => (
          <li key={f.id} className="flex flex-col justify-between gap-4 rounded-lg border border-tinta/20 bg-white/50 p-5">
            <div>
              <h2 className="font-serif text-xl font-bold text-folha">{f.name}</h2>
              <p className="text-sm text-barro">{f.municipality} / {f.state}</p>
              {f.plotCount != null && <p className="mt-1 text-sm">{f.plotCount} talhão(ões)</p>}
            </div>
            {deleting?.id === f.id ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">Excluir fazenda e todos os dados?</span>
                <button onClick={() => remove(f)} className="rounded bg-red-700 px-3 py-1 font-semibold text-white">Excluir</button>
                <button onClick={() => setDeleting(null)} className="underline">Cancelar</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 text-sm">
                <Link href={`/farms/${f.id}/map`} className="font-semibold text-folha underline underline-offset-4">Abrir mapa</Link>
                <button onClick={() => setEditing(f)} className="underline underline-offset-4">Editar</button>
                <button onClick={() => setDeleting(f)} className="text-red-700 underline underline-offset-4">Excluir</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-4 text-sm" aria-label="Paginação">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="underline disabled:opacity-40">Anterior</button>
          <span>Página {page} de {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="underline disabled:opacity-40">Próxima</button>
        </nav>
      )}
    </div>
  );
}
