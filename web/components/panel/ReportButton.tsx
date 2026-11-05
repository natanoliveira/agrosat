"use client";
import { useEffect, useRef, useState } from "react";
import { api, ApiRequestError } from "@/lib/api";

type St = { k: "idle" } | { k: "loading" } | { k: "ready"; url: string } | { k: "error"; msg: string };

const POLL_MS = 1500;
const MAX_POLLS = 80; // ~2 min

const errMsg = (e: unknown) =>
  e instanceof ApiRequestError && e.status === 422 && e.code === "NO_VALID_SCENE"
    ? "Sem cena válida para gerar o relatório."
    : e instanceof ApiRequestError && e.code === "NETWORK"
      ? "Não foi possível conectar ao servidor."
      : "Não foi possível gerar o relatório. Tente novamente.";

export default function ReportButton({ plotId }: { plotId: string }) {
  const [st, setSt] = useState<St>({ k: "idle" });
  const alive = useRef(true);
  const run = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => { run.current++; setSt({ k: "idle" }); }, [plotId]);

  async function generate() {
    const me = ++run.current;
    const live = () => alive.current && run.current === me;
    setSt({ k: "loading" });
    try {
      const { jobId } = await api.createReport(plotId);
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!live()) return;
        const job = await api.getJob(jobId);
        if (job.status === "failed") throw new Error(job.errorCode ?? "JOB_FAILED");
        if (job.status === "completed") {
          const { pdfUrl } = await api.latestReport(plotId);
          if (live()) setSt({ k: "ready", url: pdfUrl });
          return;
        }
      }
      throw new Error("timeout");
    } catch (e) {
      if (live()) setSt({ k: "error", msg: errMsg(e) });
    }
  }

  const btn = "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-sm font-medium disabled:opacity-60";
  return (
    <section aria-label="Relatório PDF" className="mt-4 border-t border-tinta/15 pt-3">
      {st.k === "loading" && (
        <p role="status" aria-live="polite" className="mb-2 text-sm text-tinta/70">Gerando relatório… costuma levar até 20 segundos.</p>
      )}
      {st.k === "error" && (
        <p role="alert" className="mb-2 rounded-xl border border-[#a8321f]/40 bg-[#a8321f]/10 p-3 text-sm text-[#a8321f]">{st.msg}</p>
      )}
      {st.k === "ready" && (
        <div role="status" className="mb-2 rounded-xl border border-folha/40 bg-folha/10 p-3 text-sm">
          <b className="block text-folha">Relatório pronto</b>
          <a href={st.url} target="_blank" rel="noopener noreferrer" download className="mt-1 inline-flex min-h-[44px] items-center font-medium text-folha underline underline-offset-4">
            Baixar PDF
          </a>
        </div>
      )}
      <button onClick={generate} disabled={st.k === "loading"} className={`${btn} w-full ${st.k === "ready" ? "border border-folha text-folha" : "bg-folha text-white"}`}>
        {st.k === "loading" ? "Gerando…" : st.k === "ready" ? "Gerar novamente" : st.k === "error" ? "Tentar novamente" : "Gerar relatório PDF"}
      </button>
    </section>
  );
}
