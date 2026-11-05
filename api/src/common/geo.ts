import { XMLParser } from 'fast-xml-parser';
import { AppException } from './errors';

export type Position = number[];
export interface Polygon {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface PolygonItem {
  name?: string;
  geometry: Polygon;
}
export interface ParsedFile {
  items: PolygonItem[];
  ignored: number;
}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_EXT = ['.geojson', '.json', '.kml'];

const isPosition = (p: unknown): p is Position =>
  Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
  Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

export function isValidPolygon(g: any): g is Polygon {
  if (!g || g.type !== 'Polygon' || !Array.isArray(g.coordinates) || g.coordinates.length === 0) return false;
  return g.coordinates.every(
    (ring: unknown) =>
      Array.isArray(ring) &&
      ring.length >= 4 &&
      ring.every(isPosition) &&
      ring[0][0] === ring[ring.length - 1][0] &&
      ring[0][1] === ring[ring.length - 1][1],
  );
}

export function explodeGeometry(g: any, name?: string): ParsedFile {
  const out: ParsedFile = { items: [], ignored: 0 };
  const walk = (geom: any, n?: string) => {
    if (!geom || typeof geom !== 'object') return void out.ignored++;
    switch (geom.type) {
      case 'Feature':
        return walk(geom.geometry, geom.properties?.name ?? n);
      case 'FeatureCollection':
        return (geom.features ?? []).forEach((f: any) => walk(f, n));
      case 'GeometryCollection':
        return (geom.geometries ?? []).forEach((x: any) => walk(x, n));
      case 'Polygon':
        return void out.items.push({ name: n, geometry: geom });
      case 'MultiPolygon':
        return (geom.coordinates ?? []).forEach((c: Position[][]) =>
          out.items.push({ name: n, geometry: { type: 'Polygon', coordinates: c } }),
        );
      default:
        out.ignored++;
    }
  };
  walk(g, name);
  return out;
}

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

const kmlRing = (ring: any): Position[] =>
  String(ring?.LinearRing?.coordinates ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => c.split(',').map(Number));

export function parseKml(xml: string): ParsedFile {
  const doc = new XMLParser({ ignoreAttributes: true, processEntities: true }).parse(xml);
  if (!doc?.kml) throw new Error('KML inválido');
  const out: ParsedFile = { items: [], ignored: 0 };

  const placemarks: any[] = [];
  const collect = (node: any) => {
    if (!node || typeof node !== 'object') return;
    placemarks.push(...arr(node.Placemark));
    arr(node.Document).forEach(collect);
    arr(node.Folder).forEach(collect);
  };
  collect(doc.kml);

  for (const pm of placemarks) {
    const geoms = [pm, ...arr(pm.MultiGeometry)];
    const polygons = geoms.flatMap((g) => arr<any>(g.Polygon));
    const others = geoms.flatMap((g) => ['Point', 'LineString'].flatMap((k) => arr(g[k])));
    out.ignored += others.length;
    for (const poly of polygons) {
      const rings = [kmlRing(poly.outerBoundaryIs), ...arr(poly.innerBoundaryIs).map(kmlRing)];
      out.items.push({ name: pm.name ? String(pm.name) : undefined, geometry: { type: 'Polygon', coordinates: rings } });
    }
  }
  return out;
}

export function parseGeoFile(filename: string, content: Buffer): ParsedFile {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new AppException('INVALID_FILE', 'Extensão não suportada. Use .geojson, .json ou .kml');
  }
  let parsed: ParsedFile;
  try {
    const text = content.toString('utf8');
    parsed = ext === '.kml' ? parseKml(text) : explodeGeometry(JSON.parse(text));
  } catch {
    throw new AppException('INVALID_FILE', 'Arquivo não pôde ser lido: formato inválido');
  }
  if (parsed.items.length === 0) {
    throw new AppException('NO_POLYGON', 'nenhum polígono encontrado no arquivo');
  }
  return parsed;
}
