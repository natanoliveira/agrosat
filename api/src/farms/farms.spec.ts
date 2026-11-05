import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../setup';
import { JobsService } from '../jobs/jobs.service';
import { DashboardService } from './dashboard.service';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

const ID = '11111111-1111-4111-8111-111111111111';
const row = { id: ID, name: 'Faz', municipality: 'Sorriso', state: 'MT', createdAt: new Date(), updatedAt: new Date() };
const known = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5' });

describe('farms', () => {
  let app: INestApplication;
  const prisma: any = {
    farm: { findMany: jest.fn(), count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    plot: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [FarmsController],
      providers: [FarmsService, FilesService, { provide: DashboardService, useValue: {} }, { provide: JobsService, useValue: {} }, { provide: PrismaService, useValue: prisma }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  const api = () => request(app.getHttpServer());

  it('201 cria', async () => {
    prisma.farm.create.mockResolvedValue(row);
    const r = await api().post('/api/v1/farms').send({ name: ' Faz ', municipality: 'Sorriso', state: 'mt' }).expect(201);
    expect(r.body.id).toBe(ID);
    expect(prisma.farm.create).toHaveBeenCalledWith({ data: { name: 'Faz', municipality: 'Sorriso', state: 'MT' } });
  });

  it('400 validação', async () => {
    const r = await api().post('/api/v1/farms').send({ name: '', municipality: 'x', state: 'MTT' }).expect(400);
    expect(r.body.code).toBe('VALIDATION_ERROR');
    expect(r.body.details.map((d: any) => d.field).sort()).toEqual(['name', 'state']);
  });

  it('409 FARM_EXISTS', async () => {
    prisma.farm.create.mockRejectedValue(known('P2002'));
    const r = await api().post('/api/v1/farms').send({ name: 'Faz', municipality: 'S', state: 'MT' }).expect(409);
    expect(r.body.code).toBe('FARM_EXISTS');
  });

  it('404 get, patch, delete e id inválido', async () => {
    prisma.farm.findUnique.mockResolvedValue(null);
    prisma.farm.update.mockRejectedValue(known('P2025'));
    prisma.farm.deleteMany.mockResolvedValue({ count: 0 });
    await api().get(`/api/v1/farms/${ID}`).expect(404);
    await api().patch(`/api/v1/farms/${ID}`).send({ name: 'n' }).expect(404);
    await api().delete(`/api/v1/farms/${ID}`).expect(404);
    const r = await api().get('/api/v1/farms/abc').expect(404);
    expect(r.body.code).toBe('NOT_FOUND');
  });

  it('get devolve plotCount', async () => {
    prisma.farm.findUnique.mockResolvedValue({ ...row, _count: { plots: 3 } });
    const r = await api().get(`/api/v1/farms/${ID}`).expect(200);
    expect(r.body.plotCount).toBe(3);
  });

  it('lista paginada, 204 delete', async () => {
    prisma.farm.findMany.mockResolvedValue([row]);
    prisma.farm.count.mockResolvedValue(1);
    const r = await api().get('/api/v1/farms?pageSize=5').expect(200);
    expect(r.body.meta).toEqual({ page: 1, pageSize: 5, total: 1 });
    prisma.farm.deleteMany.mockResolvedValue({ count: 1 });
    await api().delete(`/api/v1/farms/${ID}`).expect(204);
  });
});
