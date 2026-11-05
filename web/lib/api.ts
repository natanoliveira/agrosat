import type * as T from "./api-types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown[]) {
    super(message);
  }
}

async function req<R>(path: string, init?: RequestInit): Promise<R> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: init?.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "Não foi possível conectar ao servidor.");
  }
  if (!res.ok) {
    const e = (await res.json().catch(() => null)) as T.ApiError | null;
    throw new ApiRequestError(res.status, e?.code ?? "UNKNOWN", e?.message ?? "Erro inesperado.", e?.details);
  }
  return res.status === 204 ? (undefined as R) : ((await res.json()) as R);
}

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

const qs = (q: object) => {
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => v != null && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  listFarms: (page = 1, pageSize = 20) => req<T.Paginated<T.Farm>>(`/farms${qs({ page, pageSize })}`),
  createFarm: (b: T.FarmInput) => req<T.Farm>("/farms", json("POST", b)),
  getFarm: (id: string) => req<T.Farm>(`/farms/${id}`),
  updateFarm: (id: string, b: Partial<T.FarmInput>) => req<T.Farm>(`/farms/${id}`, json("PATCH", b)),
  deleteFarm: (id: string) => req<void>(`/farms/${id}`, json("DELETE")),
  dashboard: (id: string) => req<T.Dashboard>(`/farms/${id}/dashboard`),
  listPlots: (farmId: string) => req<T.PlotFeature[]>(`/farms/${farmId}/plots`),
  createPlot: (farmId: string, b: T.PlotInput) => req<T.PlotFeature>(`/farms/${farmId}/plots`, json("POST", b)),
  importPlots: (farmId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<{ created: T.PlotFeature[] }>(`/farms/${farmId}/plots/import`, { method: "POST", body: fd });
  },
  getPlot: (id: string) => req<T.PlotFeature>(`/plots/${id}`),
  updatePlot: (id: string, b: Partial<T.PlotInput>) => req<T.PlotFeature>(`/plots/${id}`, json("PATCH", b)),
  deletePlot: (id: string) => req<void>(`/plots/${id}`, json("DELETE")),
  processPlot: (id: string) => req<{ jobId: string }>(`/plots/${id}/process`, json("POST")),
  processFarm: (id: string) => req<{ jobIds: string[] }>(`/farms/${id}/process`, json("POST")),
  getJob: (id: string) => req<T.Job>(`/jobs/${id}`),
  scenes: (plotId: string, valid?: boolean) => req<T.Scene[]>(`/plots/${plotId}/scenes${qs({ valid })}`),
  zones: (plotId: string, date?: string) => req<T.Zones>(`/plots/${plotId}/zones${qs({ date })}`),
  pixel: (plotId: string, date: string, lng: number, lat: number) =>
    req<{ ndvi: number | null }>(`/plots/${plotId}/pixel${qs({ date, lng, lat })}`),
  alerts: (q: T.AlertQuery = {}) => req<T.Paginated<T.Alert>>(`/alerts${qs(q)}`),
  notifyWhatsapp: (alertId: string, phone?: string) =>
    req<{ simulated: true }>("/notifications/whatsapp", json("POST", { alertId, phone })),
  createReport: (plotId: string) => req<{ jobId: string }>(`/plots/${plotId}/reports`, json("POST")),
  latestReport: (plotId: string) => req<T.Report>(`/plots/${plotId}/reports/latest`),
};
