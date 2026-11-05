import type { Feature, FeatureCollection, Geometry, Polygon } from "geojson";

export type Paginated<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };

export type ApiError = { statusCode: number; code: string; message: string; details?: unknown[] };

export type Farm = { id: string; name: string; municipality: string; state: string; plotCount?: number };
export type FarmInput = { name: string; municipality: string; state: string };

export type PlotProps = { id: string; name: string; areaHa: number; needsReprocess?: boolean };
export type PlotFeature = Feature<Polygon, PlotProps>;
export type PlotInput = { name: string; geometry: Polygon };

export type Trend = "up" | "down" | "flat" | null;
export type AlertType = "drop" | "patch";
export type Severity = "medium" | "high";

export type DashboardPlot = {
  id: string;
  name: string;
  areaHa: number;
  needsReprocess: boolean;
  currentNdvi: number | null;
  trend: Trend;
  lastAlert: Alert | null;
};
export type Dashboard = { farm: Farm; plots: DashboardPlot[] };

export type JobStatus = "queued" | "running" | "completed" | "failed";
export type Job = {
  id: string;
  type: "history" | "report";
  plotId: string;
  status: JobStatus;
  errorCode: string | null;
  errorMessage: string | null;
  result: unknown;
  startedAt: string | null;
  finishedAt: string | null;
};

export type Bounds = [[number, number], [number, number]];
export type Scene = {
  date: string;
  valid: boolean;
  validPct: number;
  mean: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  pngUrl: string;
  bounds: Bounds;
  source: "stac" | "fixtures";
};

export type ZoneClass = "low" | "medium" | "high";
export type Zones = FeatureCollection<Geometry, { class: ZoneClass; areaHa: number; date: string }>;

export type Alert = {
  id: string;
  plotId: string;
  plotName: string;
  date: string;
  type: AlertType;
  severity: Severity;
  value: number;
  geometry: Geometry | null;
};
export type AlertQuery = { farmId?: string; plotId?: string; severity?: Severity; type?: AlertType; page?: number; pageSize?: number };

export type Report = { id: string; generatedAt: string; pdfUrl: string };
