import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup';
import { ZonesController } from './zones.controller';
import { ZonesRepository } from './zones.repository';
import { ZonesService } from './zones.service';

const PLOT = '22222222-2222-4222-8222-222222222222';
const poly = { type: 'MultiPolygon', coordinates: [] };

describe('zones', () => {
  let app: INestApplication;
  const prisma: any = { plot: { findUnique: jest.fn() }, ndviScene: { findFirst: jest.fn() } };
  const repo = { findByScene: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ZonesController],
      providers: [ZonesService, { provide: PrismaService, useValue: prisma }, { provide: ZonesRepository, useValue: repo }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.plot.findUnique.mockResolvedValue({ name: 'Talhão Ação 1' });
    prisma.ndviScene.findFirst.mockResolvedValue({ id: 's1', sceneDate: new Date('2024-03-01T00:00:00Z') });
    repo.findByScene.mockResolvedValue([{ class: 'low', areaHa: 1.5, geometry: poly }]);
  });
  const api = () => request(app.getHttpServer());

  it('padrão = última cena válida; FeatureCollection com class/areaHa/date', async () => {
    const r = await api().get(`/api/v1/plots/${PLOT}/zones`).expect(200);
    expect(prisma.ndviScene.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { plotId: PLOT, valid: true }, orderBy: { sceneDate: 'desc' } }));
    expect(r.body.features[0].properties).toEqual({ class: 'low', areaHa: 1.5, date: '2024-03-01' });
    expect(r.headers['content-disposition']).toBeUndefined();
  });

  it('download=1 manda Content-Disposition; date filtra a cena', async () => {
    const r = await api().get(`/api/v1/plots/${PLOT}/zones?date=2024-03-01&download=1`).expect(200);
    expect(r.headers['content-disposition']).toBe('attachment; filename="zonas-talhao-acao-1-2024-03-01.geojson"');
    expect(prisma.ndviScene.findFirst.mock.calls[0][0].where.sceneDate).toEqual(new Date('2024-03-01T00:00:00Z'));
  });

  it('404 SCENE_NOT_FOUND sem cena; 404 talhão; 400 data ruim', async () => {
    prisma.ndviScene.findFirst.mockResolvedValue(null);
    expect((await api().get(`/api/v1/plots/${PLOT}/zones?date=2024-03-02`).expect(404)).body.code).toBe('SCENE_NOT_FOUND');
    prisma.plot.findUnique.mockResolvedValue(null);
    expect((await api().get(`/api/v1/plots/${PLOT}/zones`).expect(404)).body.code).toBe('NOT_FOUND');
    await api().get(`/api/v1/plots/${PLOT}/zones?date=x`).expect(400);
  });
});
