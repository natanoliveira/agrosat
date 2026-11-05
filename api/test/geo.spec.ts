import { explodeGeometry, isValidPolygon, parseGeoFile, parseKml } from '../src/common/geo';

const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
const poly = { type: 'Polygon', coordinates: [ring] };

describe('geo', () => {
  it('Polygon válido', () => expect(isValidPolygon(poly)).toBe(true));
  it('anel aberto', () =>
    expect(isValidPolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] })).toBe(false));
  it('menos de 4 pontos', () =>
    expect(isValidPolygon({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] })).toBe(false));
  it('tipo errado', () => expect(isValidPolygon({ type: 'Point', coordinates: [0, 0] })).toBe(false));
  it('coordenada fora do range', () =>
    expect(isValidPolygon({ type: 'Polygon', coordinates: [[[0, 0], [200, 0], [1, 1], [0, 0]]] })).toBe(false));

  it('MultiPolygon com 3 partes vira 3 e conta ignorados', () => {
    const fc = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'MultiPolygon', coordinates: [[ring], [ring], [ring]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } },
      ],
    };
    const r = explodeGeometry(fc);
    expect(r.items).toHaveLength(3);
    expect(r.items[0].name).toBe('A');
    expect(r.ignored).toBe(1);
  });

  it('KML com polígono e ponto', () => {
    const kml = `<kml><Document><Placemark><name>T1</name><Polygon><outerBoundaryIs><LinearRing><coordinates>0,0,0 1,0,0 1,1,0 0,0,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark><Placemark><Point><coordinates>0,0</coordinates></Point></Placemark></Document></kml>`;
    const r = parseKml(kml);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].name).toBe('T1');
    expect(isValidPolygon(r.items[0].geometry)).toBe(true);
    expect(r.ignored).toBe(1);
  });

  it('erros de arquivo', () => {
    const code = (f: () => unknown) => { try { f(); } catch (e: any) { return e.code; } };
    expect(code(() => parseGeoFile('a.txt', Buffer.from('{}')))).toBe('INVALID_FILE');
    expect(code(() => parseGeoFile('a.json', Buffer.from('{oops')))).toBe('INVALID_FILE');
    expect(code(() => parseGeoFile('a.kml', Buffer.from('<x'))))  .toBe('INVALID_FILE');
    expect(code(() => parseGeoFile('a.json', Buffer.from(JSON.stringify({ type: 'Point', coordinates: [0, 0] }))))).toBe('NO_POLYGON');
  });
});
