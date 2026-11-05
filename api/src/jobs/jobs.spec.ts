import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UnrecoverableError } from 'bullmq';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup';
import { JobsController } from './jobs.controller';
import { JobsProcessor } from './jobs.processor';
import { JOBS_QUEUE, JobsService } from './jobs.service';
import { WorkerClient, WorkerError } from './worker.client';

const PLOT = '22222222-2222-4222-8222-222222222222';
const JOB = '33333333-3333-4333-8333-333333333333';

describe('jobs api', () => {
  let app: INestApplication;
  const tx: any = { $queryRaw: jest.fn(), job: { findFirst: jest.fn(), create: jest.fn() } };
  const prisma: any = {
    $transaction: jest.fn((cb: any) => cb(tx)),
    job: { findUnique: jest.fn(), update: jest.fn() },
    plot: { findMany: jest.fn() },
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [JobsService, { provide: PrismaService, useValue: prisma }, { provide: JOBS_QUEUE, useValue: queue }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => {
    jest.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ id: PLOT }]);
    tx.job.findFirst.mockResolvedValue(null);
  });
  const api = () => request(app.getHttpServer());

  it('202 {jobId}, trava o talhão FOR UPDATE e enfileira com retry', async () => {
    const r = await api().post(`/api/v1/plots/${PLOT}/process`).expect(202);
    expect(r.body.jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(String(tx.$queryRaw.mock.calls[0][0].join?.('') ?? tx.$queryRaw.mock.calls[0][0])).toContain('FOR UPDATE');
    expect(tx.job.create).toHaveBeenCalledWith({ data: { id: r.body.jobId, type: 'history', plotId: PLOT } });
    expect(queue.add).toHaveBeenCalledWith('history', { plotId: PLOT }, expect.objectContaining({ jobId: r.body.jobId, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }));
  });

  it('409 JOB_IN_PROGRESS', async () => {
    tx.job.findFirst.mockResolvedValue({ id: JOB });
    const r = await api().post(`/api/v1/plots/${PLOT}/process`).expect(409);
    expect(r.body.code).toBe('JOB_IN_PROGRESS');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('404 talhão inexistente', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await api().post(`/api/v1/plots/${PLOT}/process`).expect(404);
  });

  it('GET /jobs/:id devolve result', async () => {
    prisma.job.findUnique.mockResolvedValue({ id: JOB, type: 'history', plotId: PLOT, status: 'completed', errorCode: null, errorMessage: null, result: { validScenes: 2, discardedScenes: 1, source: 'fixtures' }, startedAt: null, finishedAt: null, extra: 'x' });
    const r = await api().get(`/api/v1/jobs/${JOB}`).expect(200);
    expect(r.body.result).toEqual({ validScenes: 2, discardedScenes: 1, source: 'fixtures' });
    expect(r.body.extra).toBeUndefined();
    prisma.job.findUnique.mockResolvedValue(null);
    await api().get(`/api/v1/jobs/${JOB}`).expect(404);
  });

  it('POST de fazenda reaproveita job em andamento', async () => {
    prisma.plot.findMany.mockResolvedValue([{ id: PLOT }]);
    tx.job.findFirst.mockResolvedValue({ id: JOB });
    expect(await app.get(JobsService).enqueueFarm('f')).toEqual([JOB]);
  });
});

describe('jobs processor', () => {
  const prisma: any = { job: { update: jest.fn() } };
  const plots = { findById: jest.fn() };
  const worker = { process: jest.fn() };
  const persister = { persist: jest.fn() };
  const notifications = { notifyNew: jest.fn() };
  const proc = new JobsProcessor(prisma, plots as any, worker as any, persister as any, notifications as any, jest.fn() as any);
  const job = (attemptsMade: number) => ({ id: JOB, data: { plotId: PLOT }, attemptsMade, opts: { attempts: 3 } }) as any;
  const statuses = () => prisma.job.update.mock.calls.map((c: any) => c[0].data.status);

  beforeEach(() => {
    jest.clearAllMocks();
    plots.findById.mockResolvedValue({ id: PLOT, name: 'T', geometry: {} });
    persister.persist.mockResolvedValue(['a1']);
    notifications.notifyNew.mockResolvedValue(undefined);
  });

  it('completed com contagem de cenas e notifica alertas novos', async () => {
    worker.process.mockResolvedValue({ source: 'fixtures', scenes: [{ valid: true }, { valid: false }, { valid: true }] });
    await proc.handle(job(0));
    expect(statuses()).toEqual(['running', 'completed']);
    expect(prisma.job.update.mock.calls[1][0].data.result).toEqual({ validScenes: 2, discardedScenes: 1, source: 'fixtures' });
    expect(notifications.notifyNew).toHaveBeenCalledWith(['a1']);
  });

  it('erro transitório: failed só na última tentativa', async () => {
    worker.process.mockRejectedValue(new WorkerError('STAC_UNAVAILABLE', 'x', 503));
    await expect(proc.handle(job(0))).rejects.toThrow('x');
    expect(statuses()).toEqual(['running']);
    await expect(proc.handle(job(2))).rejects.toThrow('x');
    expect(statuses()).toEqual(['running', 'running', 'failed']);
    expect(prisma.job.update.mock.calls[2][0].data.errorCode).toBe('STAC_UNAVAILABLE');
  });

  it('erro de domínio: UnrecoverableError e failed já na 1ª', async () => {
    worker.process.mockRejectedValue(new WorkerError('NO_OFFLINE_DATA', 'sem dados offline para esta área', 422));
    await expect(proc.handle(job(0))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(statuses()).toEqual(['running', 'failed']);
    expect(persister.persist).not.toHaveBeenCalled();
  });
});

describe('worker.client (stub HTTP)', () => {
  let srv: Server;
  beforeAll(async () => {
    srv = createServer((req, res) => {
      const ok = req.url === '/pixel';
      res.writeHead(ok ? 200 : 422, { 'content-type': 'application/json' });
      res.end(JSON.stringify(ok ? { ndvi: 0.7 } : { code: 'NO_OFFLINE_DATA', message: 'sem dados' }));
    });
    await new Promise<void>((r) => srv.listen(0, r));
    process.env.WORKER_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  });
  afterAll(() => srv.close());

  it('repassa sucesso e mapeia erro {code,message}', async () => {
    const c = new WorkerClient();
    expect(await c.pixel({ ndviPath: 'p', lng: 1, lat: 2 })).toEqual({ ndvi: 0.7 });
    await expect(c.process({} as any)).rejects.toMatchObject({ code: 'NO_OFFLINE_DATA', status: 422 });
  });

  it('worker fora do ar vira WORKER_UNAVAILABLE', async () => {
    process.env.WORKER_URL = 'http://127.0.0.1:1';
    await expect(new WorkerClient().pixel({ ndviPath: 'p', lng: 1, lat: 2 })).rejects.toMatchObject({ code: 'WORKER_UNAVAILABLE' });
  });
});
