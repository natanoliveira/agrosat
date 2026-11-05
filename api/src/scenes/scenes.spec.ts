import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { WorkerClient, WorkerError } from '../jobs/worker.client';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';

const PLOT = '22222222-2222-4222-8222-222222222222';
const scene = (d: string, valid = true) => ({
  sceneDate: new Date(`${d}T00:00:00Z`), valid, validPct: '88.5', mean: 0.7, median: 0.71, p10: 0.5, p90: 0.8,
  pngPath: valid ? `plots/${PLOT}/${d}/ndvi.png` : null, bounds: [[0, 0], [1, 1]], source: 'fixtures', id: 'internal',
});

describe('scenes', () => {
  let app: INestApplication;
  const prisma: any = { plot: { count: jest.fn() }, ndviScene: { findMany: jest.fn(), findUnique: jest.fn() } };
  const worker = { pixel: jest.fn() };

  beforeAll(async () => {
    process.env.PUBLIC_FILES_URL = 'http://files.test/api/v1/files';
    const mod = await Test.createTestingModule({
      controllers: [ScenesController],
      providers: [ScenesService, { provide: PrismaService, useValue: prisma }, { provide: WorkerClient, useValue: worker }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.plot.count.mockResolvedValue(1);
  });
  const api = () => request(app.getHttpServer());

  it('lista asc com pngUrl absoluta e sem campos internos', async () => {
    prisma.ndviScene.findMany.mockResolvedValue([scene('2024-01-01'), scene('2024-01-16', false)]);
    const r = await api().get(`/api/v1/plots/${PLOT}/scenes`).expect(200);
    expect(prisma.ndviScene.findMany).toHaveBeenCalledWith({ where: { plotId: PLOT }, orderBy: { sceneDate: 'asc' } });
    expect(r.body[0]).toMatchObject({ date: '2024-01-01', validPct: 88.5, pngUrl: `http://files.test/api/v1/files/plots/${PLOT}/2024-01-01/ndvi.png` });
    expect(r.body[1].pngUrl).toBeNull();
    expect(r.body[0].id).toBeUndefined();
  });

  it('?valid=true filtra; valid inválido dá 400; talhão inexistente 404', async () => {
    prisma.ndviScene.findMany.mockResolvedValue([]);
    await api().get(`/api/v1/plots/${PLOT}/scenes?valid=true`).expect(200);
    expect(prisma.ndviScene.findMany.mock.calls[0][0].where).toEqual({ plotId: PLOT, valid: true });
    await api().get(`/api/v1/plots/${PLOT}/scenes?valid=talvez`).expect(400);
    prisma.plot.count.mockResolvedValue(0);
    await api().get(`/api/v1/plots/${PLOT}/scenes`).expect(404);
  });

  it('pixel repassa ndviPath/lng/lat ao worker', async () => {
    prisma.ndviScene.findUnique.mockResolvedValue({ ndviPath: 'plots/x/ndvi.tif' });
    worker.pixel.mockResolvedValue({ ndvi: 0.72 });
    const r = await api().get(`/api/v1/plots/${PLOT}/pixel?date=2024-01-01&lng=-44.5&lat=-7.2`).expect(200);
    expect(r.body).toEqual({ ndvi: 0.72 });
    expect(worker.pixel).toHaveBeenCalledWith({ ndviPath: 'plots/x/ndvi.tif', lng: -44.5, lat: -7.2 });
  });

  it('pixel: 400 params, 404 cena, null sem raster ou worker 404', async () => {
    await api().get(`/api/v1/plots/${PLOT}/pixel?date=ontem&lng=1&lat=2`).expect(400);
    prisma.ndviScene.findUnique.mockResolvedValue(null);
    const r = await api().get(`/api/v1/plots/${PLOT}/pixel?date=2024-01-01&lng=1&lat=2`).expect(404);
    expect(r.body.code).toBe('SCENE_NOT_FOUND');
    prisma.ndviScene.findUnique.mockResolvedValue({ ndviPath: null });
    expect((await api().get(`/api/v1/plots/${PLOT}/pixel?date=2024-01-01&lng=1&lat=2`)).body).toEqual({ ndvi: null });
    prisma.ndviScene.findUnique.mockResolvedValue({ ndviPath: 'p' });
    worker.pixel.mockRejectedValue(new WorkerError('NOT_FOUND', 'x', 404));
    expect((await api().get(`/api/v1/plots/${PLOT}/pixel?date=2024-01-01&lng=1&lat=2`)).body).toEqual({ ndvi: null });
  });
});
