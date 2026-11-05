import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { setupApp } from '../setup';
import { AlertsController } from './alerts.controller';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';

const FARM = '11111111-1111-4111-8111-111111111111';

describe('alerts', () => {
  let app: INestApplication;
  const repo = { list: jest.fn() };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [AlertsService, { provide: AlertsRepository, useValue: repo }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());
  beforeEach(() => repo.list.mockResolvedValue({ rows: [{ id: 'a' }], total: 41 }));
  const api = () => request(app.getHttpServer());

  it('repassa filtros e devolve meta.total paginado', async () => {
    const r = await api().get(`/api/v1/alerts?farmId=${FARM}&severity=high&type=drop&page=2&pageSize=10`).expect(200);
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ farmId: FARM, severity: 'high', type: 'drop' }), 2, 10);
    expect(r.body).toEqual({ data: [{ id: 'a' }], meta: { page: 2, pageSize: 10, total: 41 } });
  });

  it('defaults 1/20; 400 em filtro/pageSize inválido', async () => {
    expect((await api().get('/api/v1/alerts').expect(200)).body.meta).toEqual({ page: 1, pageSize: 20, total: 41 });
    await api().get('/api/v1/alerts?severity=low').expect(400);
    await api().get('/api/v1/alerts?pageSize=101').expect(400);
    await api().get('/api/v1/alerts?farmId=x').expect(400);
  });
});
