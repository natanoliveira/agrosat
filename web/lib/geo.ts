import type { Bounds, PlotFeature } from "./api-types";

export type Coord4 = [[number, number], [number, number], [number, number], [number, number]];

// bounds da API = [[oeste, sul], [leste, norte]]; maplibre image source quer NW, NE, SE, SW
export const boundsToCoords = ([[w, s], [e, n]]: Bounds): Coord4 => [[w, n], [e, n], [e, s], [w, s]];

export const plotsBounds = (plots: PlotFeature[]): Bounds | null => {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const p of plots) for (const [x, y] of p.geometry.coordinates[0]) {
    w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
  }
  return w === Infinity ? null : [[w, s], [e, n]];
};

export const geometryBbox = (g: import("geojson").Geometry | null): Bounds | null => {
  if (!g) return null;
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const walk = (c: unknown): void => {
    if (typeof (c as number[])[0] === "number") {
      const [x, y] = c as number[];
      w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y);
    } else (c as unknown[]).forEach(walk);
  };
  if ("coordinates" in g) walk(g.coordinates);
  return w === Infinity ? null : [[w, s], [e, n]];
};
