import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup';
import { DashboardService, trend } from './dashboard.service';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

const FARM = '11111111-1111-4111-8111-111111111111';
const farm = { id: FARM, name: 'F', municipality: 'M', state: 'PI', createdAt: new Date(), updatedAt: new Date() };
const base = { areaHa: 10, needsReprocess: false, alertId: null, alertType: null, alertSeverity: null, alertDate: null, alertValue: null };

describe('dashboard', () => {
  let app: INestApplication;
  const prisma: any = { farm: { findUnique: jest.fn() }, $queryRaw: jest.fn() };
  const jobs = { enqueueFarm: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [FarmsController],
      providers: [
        DashboardService,
        { provide: FarmsService, useValue: { get: jest.fn() } },
        { provide: JobsService, useValue: jobs },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.farm.findUnique.mockResolvedValue(farm);
  });
  const api = () => request(app.getHttpServer());

  it('trend flat quando |Δ| < 0,02', () => {
    expect(trend(0.019)).toBe('flat');
    expect(trend(-0.019)).toBe('flat');
    expect(trend(0.02)).toBe('up');
    expect(trend(-0.05)).toBe('down');
  });

  it('um card por talhão: null sem cenas, trend, needsReprocess, lastAlert', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { ...base, id: 'p1', name: 'A', means: null },
      { ...base, id: 'p2', name: 'B', means: [0.6] },
      { ...base, id: 'p3', name: 'C', means: [0.5, 0.7], needsReprocess: true, alertId: 'a1', alertType: 'drop', alertSeverity: 'high', alertDate: '2024-03-01', alertValue: 30 },
      { ...base, id: 'p4', name: 'D', means: [0.71, 0.7] },
    ]);
    const r = await api().get(`/api/v1/farms/${FARM}/dashboard`).expect(200);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const [a, b, c, d] = r.body.plots;
    expect(a).toMatchObject({ currentNdvi: null, trend: null, lastAlert: null });
    expect(b).toMatchObject({ currentNdvi: 0.6, trend: null });
    expect(c).toMatchObject({ currentNdvi: 0.5, trend: 'down', needsReprocess: true, lastAlert: { id: 'a1', type: 'drop', severity: 'high', date: '2024-03-01', value: 30 } });
    expect(d.trend).toBe('flat');
    expect(r.body.farm.id).toBe(FARM);
  });

  it('404 fazenda inexistente', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);
    await api().get(`/api/v1/farms/${FARM}/dashboard`).expect(404);
  });

  it('POST /farms/:id/process devolve 202 {jobIds}', async () => {
    jobs.enqueueFarm.mockResolvedValue(['j1', 'j2']);
    const r = await api().post(`/api/v1/farms/${FARM}/process`).expect(202);
    expect(r.body).toEqual({ jobIds: ['j1', 'j2'] });
  });
});
