import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { HealthController } from '../src/health.controller';
import { setupApp } from '../src/setup';

describe('security', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agrosat-sec-'));
    process.env.DATA_DIR = dir;
    process.env.WEB_ORIGIN = 'http://localhost:3005';
    mkdirSync(join(dir, 'plots'), { recursive: true });
    writeFileSync(join(dir, 'plots/a.png'), 'png');
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 5 }])],
      controllers: [FilesController, HealthController],
      providers: [FilesService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
    })
      .useMocker(() => ({}))
      .compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
  });
  afterAll(() => app.close());

  const get = (p: string, origin?: string) => {
    const r = request(app.getHttpServer()).get(`/api/v1/${p}`);
    return origin ? r.set('Origin', origin) : r;
  };

  it('CORS só para WEB_ORIGIN', async () => {
    expect((await get('files/plots/a.png', 'http://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
    expect((await get('files/plots/a.png', 'http://localhost:3005')).headers['access-control-allow-origin']).toBe('http://localhost:3005');
  });

  it('helmet ativo e /files liberado para outra origem', async () => {
    const r = await get('files/plots/a.png').expect(200);
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });

  it('estourar o limite dá 429', async () => {
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await get('files/plots/a.png')).status;
    expect(last).toBe(429);
  });
});
