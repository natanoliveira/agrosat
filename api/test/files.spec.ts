import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { FilesController } from '../src/files/files.controller';
import { FilesService } from '../src/files/files.service';
import { setupApp } from '../src/setup';

describe('files', () => {
  let app: INestApplication;
  let dir: string;
  let service: FilesService;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'agrosat-'));
    process.env.DATA_DIR = join(dir, 'data');
    mkdirSync(join(dir, 'data/plots/p1/2024-01-01'), { recursive: true });
    writeFileSync(join(dir, 'data/plots/p1/2024-01-01/ndvi.png'), 'png');
    writeFileSync(join(dir, 'data/plots/p1/z.geojson'), '{}');
    writeFileSync(join(dir, 'secret.txt'), 'segredo');
    const mod = await Test.createTestingModule({ controllers: [FilesController], providers: [FilesService] }).compile();
    app = mod.createNestApplication();
    setupApp(app);
    await app.init();
    service = mod.get(FilesService);
  });
  afterAll(() => app.close());

  const get = (p: string) => request(app.getHttpServer()).get(`/api/v1/files/${p}`);

  it('serve com Content-Type certo', async () => {
    expect((await get('plots/p1/2024-01-01/ndvi.png').expect(200)).headers['content-type']).toMatch(/image\/png/);
    expect((await get('plots/p1/z.geojson').expect(200)).headers['content-type']).toMatch(/json/);
  });

  it.each(['../secret.txt', '%2e%2e/secret.txt', 'plots/../../secret.txt', '..%2fsecret.txt', 'plots/p1/%2e%2e/%2e%2e/%2e%2e/secret.txt'])(
    'path traversal %s dá 404',
    async (p) => {
      const r = await get(p);
      expect(r.status).toBe(404);
      expect(r.body.code).toBe('NOT_FOUND');
    },
  );

  it('404 para inexistente e diretório', async () => {
    await get('plots/p1/nada.png').expect(404);
    await get('plots/p1').expect(404);
  });

  it('pasta do talhão some após remoção', async () => {
    await service.removePlotDirs(['p1']);
    expect(existsSync(join(dir, 'data/plots/p1'))).toBe(false);
    await get('plots/p1/z.geojson').expect(404);
  });
});
