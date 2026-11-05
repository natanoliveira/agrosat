"use client";
import { useState } from "react";
import { api, ApiRequestError } from "@/lib/api";
import type { Farm } from "@/lib/api-types";

const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const field = "w-full rounded border border-tinta/30 bg-white/70 px-3 py-2 focus:border-folha focus:outline-none focus:ring-2 focus:ring-folha/30";

export default function FarmForm({ farm, onSaved, onCancel }: { farm?: Farm; onSaved: () => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      name: String(f.get("name")).trim(),
      municipality: String(f.get("municipality")).trim(),
      state: String(f.get("state")),
    };
    setBusy(true);
    setError(null);
    try {
      if (farm) await api.updateFarm(farm.id, body);
      else await api.createFarm(body);
      onSaved();
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.code === "FARM_EXISTS"
          ? "Já existe uma fazenda com esse nome."
          : err instanceof Error ? err.message : "Erro inesperado.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-tinta/20 bg-white/50 p-5" aria-label={farm ? "Editar fazenda" : "Nova fazenda"}>
      <h2 className="font-serif text-xl font-bold">{farm ? "Editar fazenda" : "Nova fazenda"}</h2>
      <label className="block text-sm font-medium">
        Nome
        <input name="name" required maxLength={120} defaultValue={farm?.name} className={`${field} mt-1`} />
      </label>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <label className="block text-sm font-medium">
          Município
          <input name="municipality" required maxLength={120} defaultValue={farm?.municipality} className={`${field} mt-1`} />
        </label>
        <label className="block text-sm font-medium">
          UF
          <select name="state" required defaultValue={farm?.state ?? ""} className={`${field} mt-1`}>
            <option value="" disabled>Selecione</option>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
      </div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded px-4 py-2 text-sm underline underline-offset-4">Cancelar</button>
        <button disabled={busy} className="rounded bg-folha px-5 py-2 text-sm font-semibold text-solo disabled:opacity-60">
          {busy ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}
