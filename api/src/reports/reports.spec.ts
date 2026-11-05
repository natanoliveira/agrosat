import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { JOBS_QUEUE } from '../jobs/jobs.service';
import { WorkerError } from '../jobs/worker.client';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup';
import { ReportRunner } from './report.runner';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const PLOT = '22222222-2222-4222-8222-222222222222';

describe('reports api', () => {
  let app: INestApplication;
  const prisma: any = {
    plot: { findUnique: jest.fn() },
    ndviScene: { count: jest.fn(), findMany: jest.fn() },
    job: { create: jest.fn(), update: jest.fn() },
    report: { findFirst: jest.fn(), create: jest.fn() },
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }, { provide: JOBS_QUEUE, useValue: queue }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.plot.findUnique.mockResolvedValue({ id: PLOT });
    prisma.ndviScene.count.mockResolvedValue(2);
  });
  const api = () => request(app.getHttpServer());

  it('202 {jobId} e enfileira job report', async () => {
    const r = await api().post(`/api/v1/plots/${PLOT}/reports`).expect(202);
    expect(prisma.job.create).toHaveBeenCalledWith({ data: { id: r.body.jobId, type: 'report', plotId: PLOT } });
    expect(queue.add).toHaveBeenCalledWith('report', { plotId: PLOT }, expect.objectContaining({ jobId: r.body.jobId, attempts: 3 }));
  });

  it('422 NO_VALID_SCENE e 404 talhão', async () => {
    prisma.ndviScene.count.mockResolvedValue(0);
    const r = await api().post(`/api/v1/plots/${PLOT}/reports`).expect(422);
    expect(r.body.code).toBe('NO_VALID_SCENE');
    expect(queue.add).not.toHaveBeenCalled();
    prisma.plot.findUnique.mockResolvedValue(null);
    await api().post(`/api/v1/plots/${PLOT}/reports`).expect(404);
  });

  it('latest devolve pdfUrl; 404 sem relatório', async () => {
    prisma.report.findFirst.mockResolvedValue({ id: 'r1', generatedAt: new Date('2026-01-01'), pdfPath: `reports/${PLOT}/a.pdf` });
    const r = await api().get(`/api/v1/plots/${PLOT}/reports/latest`).expect(200);
    expect(r.body.pdfUrl).toMatch(new RegExp(`/files/reports/${PLOT}/a\\.pdf$`));
    prisma.report.findFirst.mockResolvedValue(null);
    await api().get(`/api/v1/plots/${PLOT}/reports/latest`).expect(404);
  });
});

describe('report runner', () => {
  const prisma: any = { ndviScene: { findMany: jest.fn() }, report: { create: jest.fn().mockResolvedValue({ id: 'r1' }) } };
  const plots = { findById: jest.fn().mockResolvedValue({ id: PLOT, name: 'T', areaHa: 3, geometry: {} }) };
  const alerts = { list: jest.fn().mockResolvedValue({ rows: [{ date: '2026-01-02' }] }) };
  const worker = { report: jest.fn().mockResolvedValue({ pdfPath: 'reports/x.pdf' }) };
  const runner = new ReportRunner(prisma, plots as any, alerts as any, worker as any);

  it('sem cena válida: NO_VALID_SCENE', async () => {
    prisma.ndviScene.findMany.mockResolvedValue([]);
    await expect(runner.run('j', PLOT)).rejects.toMatchObject({ code: 'NO_VALID_SCENE' });
  });

  it('usa a última cena e grava report', async () => {
    const s = (d: string) => ({ sceneDate: new Date(d), mean: 0.5, median: 0.5, p10: 0.1, p90: 0.9, pngPath: `plots/${PLOT}/${d}/ndvi.png`, bounds: [[0, 0], [1, 1]] });
    prisma.ndviScene.findMany.mockResolvedValue([s('2026-01-01'), s('2026-01-02')]);
    expect(await runner.run('j', PLOT)).toEqual({ reportId: 'r1' });
    const body = worker.report.mock.calls[0][0];
    expect(body.latest.zonesPath).toBe(`plots/${PLOT}/2026-01-02/zones.geojson`);
    expect(body.scenes).toHaveLength(2);
    expect(prisma.report.create).toHaveBeenCalledWith({ data: { plotId: PLOT, jobId: 'j', pdfPath: 'reports/x.pdf' }, select: { id: true } });
  });

  it('worker.report é WorkerError-compatível', () => {
    expect(new WorkerError('NO_VALID_SCENE', 'x').code).toBe('NO_VALID_SCENE');
  });
});
