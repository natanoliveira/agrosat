"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";

type St = { k: "idle" } | { k: "loading" } | { k: "done" } | { k: "error"; msg: string };

const POLL_MS = 2000;
const MAX_POLLS = 150; // ~5 min

const errMsg = (code?: string) =>
  code === "JOB_IN_PROGRESS" ? "Já existe um processamento em andamento."
  : code === "NO_OFFLINE_DATA" ? "Sem dados offline para esta área."
  : code === "NETWORK" ? "Não foi possível conectar ao servidor."
  : "Não foi possível processar o histórico. Tente novamente.";

export default function ProcessButton({ plotId, onDone }: { plotId: string; onDone: () => void }) {
  const [st, setSt] = useState<St>({ k: "idle" });
  const alive = useRef(true);
  const run = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => { run.current++; setSt({ k: "idle" }); }, [plotId]);

  async function start() {
    const me = ++run.current;
    const live = () => alive.current && run.current === me;
    setSt({ k: "loading" });
    try {
      const { jobId } = await api.processPlot(plotId);
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!live()) return;
        const job = await api.getJob(jobId);
        if (job.status === "failed") throw new ApiRequestError(0, job.errorCode ?? "JOB_FAILED", job.errorMessage ?? "");
        if (job.status === "completed") {
          if (live()) { setSt({ k: "done" }); onDone(); }
          return;
        }
      }
      throw new Error("timeout");
    } catch (e) {
      if (live()) setSt({ k: "error", msg: errMsg(e instanceof ApiRequestError ? e.code : undefined) });
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      {st.k === "loading" && <p role="status" aria-live="polite" className="text-sm">Processando histórico… pode levar alguns minutos.</p>}
      {st.k === "error" && <p role="alert" className="rounded bg-barro px-3 py-1.5 text-sm text-solo">{st.msg}</p>}
      <button
        onClick={start}
        disabled={st.k === "loading"}
        className="pointer-events-auto min-h-[44px] rounded-xl bg-folha px-4 text-sm font-medium text-solo disabled:opacity-60"
      >
        {st.k === "loading" ? "Processando…" : st.k === "error" ? "Tentar novamente" : "Processar histórico"}
      </button>
    </div>
  );
}
