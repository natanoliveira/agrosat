import { Injectable } from '@nestjs/common';
import { Polygon } from '../common/geo';

export interface WorkerAlert {
  type: 'drop' | 'patch';
  severity: 'medium' | 'high';
  value: number;
  geometry: Record<string, unknown> | null;
}

export interface ZoneFeature {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown };
  properties: { class: 'low' | 'medium' | 'high'; areaHa: number };
}

export interface WorkerScene {
  date: string;
  valid: boolean;
  validPct: number;
  stats: { mean: number; median: number; p10: number; p90: number } | null;
  pngPath: string | null;
  ndviPath: string | null;
  bounds: number[][];
  zones: { type: 'FeatureCollection'; features: ZoneFeature[] } | null;
  alerts: WorkerAlert[];
}

export interface ProcessRequest {
  plotId: string;
  plotName: string;
  geometry: Polygon;
  dateFrom: string;
  dateTo: string;
}

export interface ProcessResponse {
  source: 'stac' | 'fixtures';
  scenes: WorkerScene[];
}

export class WorkerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

@Injectable()
export class WorkerClient {
  process(body: ProcessRequest) {
    return this.post<ProcessResponse>('/process', body);
  }

  pixel(body: { ndviPath: string; lng: number; lat: number }) {
    return this.post<{ ndvi: number | null }>('/pixel', body);
  }

  report(body: unknown) {
    return this.post<{ pdfPath: string }>('/report', body);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = (process.env.WORKER_URL ?? 'http://worker:8000') + path;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Number(process.env.WORKER_TIMEOUT_MS ?? 120000)),
      });
    } catch (e) {
      const timeout = e instanceof Error && e.name === 'TimeoutError';
      throw new WorkerError(
        timeout ? 'WORKER_TIMEOUT' : 'WORKER_UNAVAILABLE',
        timeout ? 'O processamento excedeu o tempo limite' : 'Serviço de processamento indisponível',
      );
    }
    const json = (await res.json().catch(() => null)) as (T & { code?: string; message?: string }) | null;
    if (!res.ok) throw new WorkerError(json?.code ?? 'WORKER_ERROR', json?.message ?? 'Erro no serviço de processamento', res.status);
    return json as T;
  }
}
