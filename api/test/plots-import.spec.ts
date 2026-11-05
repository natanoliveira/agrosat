import request from 'supertest';
import { PLOT, geometry, plotsApp, row } from './plots-app';

const FARM = '11111111-1111-4111-8111-111111111111';
const ring = geometry.coordinates;

describe('plots-import', () => {
  let ctx: Awaited<ReturnType<typeof plotsApp>>;
  beforeAll(async () => (ctx = await plotsApp()));
  afterAll(() => ctx.app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    ctx.repo.isValid.mockResolvedValue(true);
    ctx.prisma.farm.count.mockResolvedValue(1);
    ctx.repo.insert.mockImplementation(async (_f: string, name: string) => row({ name }));
  });

  const post = (content: Buffer | string, filename: string) =>
    request(ctx.app.getHttpServer()).post(`/api/v1/farms/${FARM}/plots/import`).attach('file', Buffer.from(content), filename);
  const geo = (g: unknown) => JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: g }] });

  it('MultiPolygon de 3 partes cria 3 e conta ignorados', async () => {
    const fc = JSON.parse(geo({ type: 'MultiPolygon', coordinates: [ring, ring, ring] }));
    fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } });
    const r = await post(JSON.stringify(fc), 'a.geojson').expect(201);
    expect(r.body.created).toHaveLength(3);
    expect(r.body.ignored).toBe(1);
    expect(ctx.repo.insert).toHaveBeenCalledTimes(3);
  });

  it('INVALID_FILE: extensão, conteúdo e ausência de arquivo', async () => {
    expect((await post('{}', 'a.txt').expect(400)).body.code).toBe('INVALID_FILE');
    expect((await post('{oops', 'a.json').expect(400)).body.code).toBe('INVALID_FILE');
    const r = await request(ctx.app.getHttpServer()).post(`/api/v1/farms/${FARM}/plots/import`).expect(400);
    expect(r.body.code).toBe('INVALID_FILE');
  });

  it('INVALID_FILE acima de 5 MB', async () => {
    const r = await post(Buffer.alloc(5 * 1024 * 1024 + 10, 32), 'a.json').expect(400);
    expect(r.body.code).toBe('INVALID_FILE');
  });

  it('NO_POLYGON', async () => {
    const r = await post(geo({ type: 'Point', coordinates: [0, 0] }), 'a.json').expect(400);
    expect(r.body).toMatchObject({ code: 'NO_POLYGON', message: 'nenhum polígono encontrado no arquivo' });
  });

  it('geometria inválida: 400 e transação aborta (nenhum commit)', async () => {
    ctx.repo.isValid.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const r = await post(geo({ type: 'MultiPolygon', coordinates: [ring, ring] }), 'a.json').expect(400);
    expect(r.body.code).toBe('INVALID_GEOMETRY');
    expect(ctx.repo.insert).toHaveBeenCalledTimes(1);
    expect(ctx.prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('anel aberto é INVALID_GEOMETRY e nada é inserido', async () => {
    const open = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] };
    const r = await post(geo(open), 'a.json').expect(400);
    expect(r.body.code).toBe('INVALID_GEOMETRY');
    expect(ctx.repo.insert).not.toHaveBeenCalled();
  });

  it('KML', async () => {
    const kml = `<kml><Placemark><name>K</name><Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,0 1,1 0,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
    const r = await post(kml, 'a.kml').expect(201);
    expect(r.body.created[0].properties.name).toBe('K');
    expect(PLOT).toBeDefined();
  });
});
