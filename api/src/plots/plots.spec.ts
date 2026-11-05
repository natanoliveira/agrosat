import request from 'supertest';
import { FARM, PLOT, geometry, plotsApp, row } from '../../test/plots-app';

describe('plots', () => {
  let ctx: Awaited<ReturnType<typeof plotsApp>>;
  beforeAll(async () => (ctx = await plotsApp()));
  afterAll(() => ctx.app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    ctx.repo.isValid.mockResolvedValue(true);
    ctx.prisma.farm.count.mockResolvedValue(1);
  });
  const api = () => request(ctx.app.getHttpServer());

  it('201 cria e devolve Feature com areaHa', async () => {
    ctx.repo.insert.mockResolvedValue(row());
    const r = await api().post(`/api/v1/farms/${FARM}/plots`).send({ name: 'T1', geometry }).expect(201);
    expect(r.body.type).toBe('Feature');
    expect(r.body.properties.areaHa).toBe(12.5);
  });

  it('INVALID_GEOMETRY antes do insert (estrutural e ST_IsValid)', async () => {
    const open = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] };
    let r = await api().post(`/api/v1/farms/${FARM}/plots`).send({ name: 'T', geometry: open }).expect(400);
    expect(r.body.code).toBe('INVALID_GEOMETRY');
    ctx.repo.isValid.mockResolvedValue(false);
    r = await api().post(`/api/v1/farms/${FARM}/plots`).send({ name: 'T', geometry }).expect(400);
    expect(r.body.code).toBe('INVALID_GEOMETRY');
    expect(ctx.repo.insert).not.toHaveBeenCalled();
  });

  it('400 sem name, 404 fazenda inexistente', async () => {
    await api().post(`/api/v1/farms/${FARM}/plots`).send({ geometry }).expect(400);
    ctx.prisma.farm.count.mockResolvedValue(0);
    await api().post(`/api/v1/farms/${FARM}/plots`).send({ name: 'T', geometry }).expect(404);
    await api().get(`/api/v1/farms/${FARM}/plots`).expect(404);
  });

  it('PATCH de geometria recalcula área e liga needsReprocess', async () => {
    ctx.repo.update.mockResolvedValue(row({ areaHa: 99, needsReprocess: true }));
    const r = await api().patch(`/api/v1/plots/${PLOT}`).send({ geometry }).expect(200);
    expect(ctx.repo.update).toHaveBeenCalledWith(PLOT, { name: undefined, geometry });
    expect(r.body.properties).toMatchObject({ areaHa: 99, needsReprocess: true });
  });

  it('PATCH só nome não valida geometria; geometria inválida 400', async () => {
    ctx.repo.update.mockResolvedValue(row({ name: 'N' }));
    await api().patch(`/api/v1/plots/${PLOT}`).send({ name: 'N' }).expect(200);
    expect(ctx.repo.isValid).not.toHaveBeenCalled();
    await api().patch(`/api/v1/plots/${PLOT}`).send({ geometry: { type: 'Point', coordinates: [0, 0] } }).expect(400);
  });

  it('404 get/patch/delete; delete remove pasta só após sucesso', async () => {
    ctx.repo.findById.mockResolvedValue(null);
    ctx.repo.update.mockResolvedValue(null);
    ctx.repo.delete.mockResolvedValue(false);
    await api().get(`/api/v1/plots/${PLOT}`).expect(404);
    await api().patch(`/api/v1/plots/${PLOT}`).send({ name: 'x' }).expect(404);
    await api().delete(`/api/v1/plots/${PLOT}`).expect(404);
    expect(ctx.files.removePlotDirs).not.toHaveBeenCalled();
    ctx.repo.delete.mockResolvedValue(true);
    await api().delete(`/api/v1/plots/${PLOT}`).expect(204);
    expect(ctx.files.removePlotDirs).toHaveBeenCalledWith([PLOT]);
  });

  it('lista por fazenda', async () => {
    ctx.repo.findByFarm.mockResolvedValue([row()]);
    const r = await api().get(`/api/v1/farms/${FARM}/plots`).expect(200);
    expect(r.body).toHaveLength(1);
  });
});
