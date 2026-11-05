import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AlertsRepository } from '../alerts/alerts.repository';
import { setupApp } from '../setup';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

const ALERT = '44444444-4444-4444-8444-444444444444';

describe('notifications', () => {
  let app: INestApplication;
  let svc: NotificationsService;
  const repo = { findById: jest.fn(), markNotified: jest.fn() };
  const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [NotificationsService, { provide: AlertsRepository, useValue: repo }],
    }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    svc = app.get(NotificationsService);
  });
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('202 {simulated:true} + log, telefone mascarado', async () => {
    repo.findById.mockResolvedValue({ id: ALERT });
    const r = await request(app.getHttpServer()).post('/api/v1/notifications/whatsapp').send({ alertId: ALERT, phone: '+5586999991234' }).expect(202);
    expect(r.body).toEqual({ simulated: true });
    const line = String(log.mock.calls[0][0]);
    expect(line).toContain('notification.simulated');
    expect(line).toContain('"phone":"***"');
    expect(line).not.toContain('5586999991234');
  });

  it('404 alerta inexistente, 400 payload inválido', async () => {
    repo.findById.mockResolvedValue(null);
    await request(app.getHttpServer()).post('/api/v1/notifications/whatsapp').send({ alertId: ALERT }).expect(404);
    await request(app.getHttpServer()).post('/api/v1/notifications/whatsapp').send({ alertId: 'x' }).expect(400);
  });

  it('notifyNew só loga os que tinham notifiedAt nulo', async () => {
    repo.markNotified.mockResolvedValue(['a1']);
    await svc.notifyNew(['a1', 'a2']);
    expect(repo.markNotified).toHaveBeenCalledWith(['a1', 'a2']);
    expect(log).toHaveBeenCalledTimes(1);
  });
});
