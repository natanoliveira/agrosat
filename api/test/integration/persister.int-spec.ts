import { AlertsRepository } from '../../src/alerts/alerts.repository';
import { ResultPersister } from '../../src/jobs/result.persister';
import { ProcessResponse, WorkerScene } from '../../src/jobs/worker.client';
import { PlotsRepository } from '../../src/plots/plots.repository';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ZonesRepository } from '../../src/zones/zones.repository';

const sq = (x: number, y: number, s: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});
const win = { dateFrom: '2024-01-01', dateTo: '2024-03-31' };
const zones = () => ({
  type: 'FeatureCollection' as const,
  features: (['low', 'medium', 'high'] as const).map((c, i) => ({
    type: 'Feature' as const,
    geometry: sq(-44.5 + i * 0.001, -7.2, 0.001),
    properties: { class: c, areaHa: 1 + i },
  })),
});
const scene = (date: string, o: Partial<WorkerScene> = {}): WorkerScene => ({
  date, valid: true, validPct: 90, stats: { mean: 0.7, median: 0.7, p10: 0.5, p90: 0.8 },
  pngPath: `plots/x/${date}/ndvi.png`, ndviPath: `plots/x/${date}/ndvi.tif`, bounds: [[0, 0], [1, 1]],
  zones: zones(), alerts: [], ...o,
});
const drop = { type: 'drop' as const, severity: 'high' as const, value: 30, geometry: null };
const patch = { type: 'patch' as const, severity: 'medium' as const, value: 2, geometry: sq(-44.5, -7.2, 0.0005) };

describe('result persister', () => {
  const prisma = new PrismaService();
  const persister = new ResultPersister(prisma, new ZonesRepository(prisma), new AlertsRepository(prisma));
  let farmId: string;
  let plotId: string;

  const counts = async () => ({
    scenes: await prisma.ndviScene.count({ where: { plotId } }),
    zones: await prisma.zone.count({ where: { scene: { plotId } } }),
    alerts: await prisma.alert.count({ where: { plotId } }),
  });
  const run = (scenes: WorkerScene[], readAt = new Date()) => persister.persist(plotId, win, { source: 'fixtures', scenes } as ProcessResponse, readAt);

  beforeAll(async () => {
    await prisma.$connect();
    farmId = (await prisma.farm.create({ data: { name: `int-persist-${Date.now()}`, municipality: 'X', state: 'PI' } })).id;
    plotId = (await new PlotsRepository(prisma).insert(farmId, 'P', sq(-44.5, -7.2, 0.01))).id;
  });
  afterAll(async () => {
    await prisma.farm.deleteMany({ where: { name: { startsWith: 'int-persist-' } } });
    await prisma.$disconnect();
  });

  it('idempotente: 2x mantém contagens; inserted só no 1º insert; alerta ausente é removido', async () => {
    await prisma.$executeRaw`UPDATE plot SET "needsReprocess" = true WHERE id = ${plotId}::uuid`;
    const full = [scene('2024-01-10'), scene('2024-01-25', { alerts: [drop, patch] }), scene('2024-02-09', { valid: false, stats: null, pngPath: null, ndviPath: null, zones: null })];

    const first = await run(full);
    expect(first).toHaveLength(2);
    expect(await counts()).toEqual({ scenes: 3, zones: 6, alerts: 2 });
    expect((await prisma.$queryRaw<{ n: boolean }[]>`SELECT "needsReprocess" AS n FROM plot WHERE id = ${plotId}::uuid`)[0].n).toBe(false);
    await prisma.alert.updateMany({ where: { plotId }, data: { notifiedAt: new Date() } });

    expect(await run(full)).toEqual([]);
    expect(await counts()).toEqual({ scenes: 3, zones: 6, alerts: 2 });
    expect(await prisma.alert.count({ where: { plotId, notifiedAt: null } })).toBe(0);

    const second = await run([scene('2024-01-10'), scene('2024-01-25', { alerts: [drop] })]);
    expect(second).toEqual([]);
    expect(await counts()).toEqual({ scenes: 2, zones: 6, alerts: 1 });
    expect((await prisma.alert.findFirstOrThrow({ where: { plotId } })).type).toBe('drop');
  });

  it('needsReprocess não zera se a geometria mudou depois da leitura', async () => {
    await prisma.$executeRaw`UPDATE plot SET "needsReprocess" = true, "updatedAt" = now() WHERE id = ${plotId}::uuid`;
    await run([scene('2024-01-10')], new Date(Date.now() - 60_000));
    expect((await prisma.$queryRaw<{ n: boolean }[]>`SELECT "needsReprocess" AS n FROM plot WHERE id = ${plotId}::uuid`)[0].n).toBe(true);
  });
});
