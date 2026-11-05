import { PlotsRepository } from '../../src/plots/plots.repository';
import { PrismaService } from '../../src/prisma/prisma.service';

const sq = (x: number, y: number, s: number) => ({
  type: 'Polygon' as const,
  coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]],
});
const bowtie = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] };

describe('postgis', () => {
  const prisma = new PrismaService();
  const repo = new PlotsRepository(prisma);
  const farmName = `int-${Date.now()}`;
  let farmId: string;

  beforeAll(async () => {
    await prisma.$connect();
    farmId = (await prisma.farm.create({ data: { name: farmName, municipality: 'X', state: 'MT' } })).id;
  });
  afterAll(async () => {
    await prisma.farm.deleteMany({ where: { name: { startsWith: 'int-' } } });
    await prisma.$disconnect();
  });

  it('area em ha calculada no SQL e recalculada no update', async () => {
    const p = await repo.insert(farmId, 'A', sq(-55, -12, 0.01));
    const [{ expected }] = await prisma.$queryRaw<{ expected: number }[]>`
      SELECT ST_Area(geom::geography)/10000 AS expected FROM plot WHERE id = ${p.id}::uuid`;
    expect(p.areaHa).toBeCloseTo(Math.round(expected * 1e4) / 1e4, 4);
    expect(p.areaHa).toBeGreaterThan(100);
    expect(p.needsReprocess).toBe(false);

    const u = await repo.update(p.id, { geometry: sq(-55, -12, 0.02) });
    expect(u!.areaHa).toBeGreaterThan(p.areaHa * 3.5);
    expect(u!.needsReprocess).toBe(true);
    const n = await repo.update(p.id, { name: 'B' });
    expect(n).toMatchObject({ name: 'B', needsReprocess: true });
    expect(n!.geometry.type).toBe('Polygon');
  });

  it('isValid rejeita auto-interseção; CHECK é a rede final', async () => {
    expect(await repo.isValid(bowtie)).toBe(false);
    expect(await repo.isValid(sq(0, 0, 1))).toBe(true);
    await expect(repo.insert(farmId, 'bad', bowtie)).rejects.toThrow();
  });

  it('uniques: farm.name, scene(plot,date), zone(scene,class), alert(plot,date,type)', async () => {
    await expect(prisma.farm.create({ data: { name: farmName, municipality: 'X', state: 'MT' } })).rejects.toMatchObject({ code: 'P2002' });
    const p = await repo.insert(farmId, 'U', sq(-54, -12, 0.01));
    const scene = { plotId: p.id, sceneDate: new Date('2024-01-01'), source: 'fixtures' as const, valid: true, validPct: 100, bounds: [[0, 0], [1, 1]] };
    const s = await prisma.ndviScene.create({ data: scene });
    await expect(prisma.ndviScene.create({ data: scene })).rejects.toMatchObject({ code: 'P2002' });

    const zone = () => prisma.$executeRaw`INSERT INTO zone (id, "sceneId", class, geom, "areaHa", "updatedAt")
      VALUES (gen_random_uuid(), ${s.id}::uuid, 'low', ST_Multi(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 0))', 4326)), 1, now())`;
    await zone();
    await expect(zone()).rejects.toThrow(/unique|duplicate|23505/i);

    const alert = () => prisma.alert.create({ data: { plotId: p.id, sceneId: s.id, sceneDate: new Date('2024-01-01'), type: 'drop', severity: 'high', value: 30 } });
    await alert();
    await expect(alert()).rejects.toMatchObject({ code: 'P2002' });
  });

  it('cascata: apagar a fazenda remove talhões, cenas, zonas e alertas', async () => {
    const f = await prisma.farm.create({ data: { name: `int-cascade-${Date.now()}`, municipality: 'X', state: 'MT' } });
    const p = await repo.insert(f.id, 'C', sq(-53, -12, 0.01));
    const s = await prisma.ndviScene.create({
      data: { plotId: p.id, sceneDate: new Date('2024-02-01'), source: 'stac', valid: false, validPct: 0, bounds: [] },
    });
    await prisma.$executeRaw`INSERT INTO zone (id, "sceneId", class, geom, "areaHa", "updatedAt")
      VALUES (gen_random_uuid(), ${s.id}::uuid, 'high', ST_Multi(ST_GeomFromText('POLYGON((0 0,1 0,1 1,0 0))', 4326)), 1, now())`;
    await prisma.alert.create({ data: { plotId: p.id, sceneId: s.id, sceneDate: s.sceneDate, type: 'patch', severity: 'medium', value: 1 } });

    await prisma.farm.delete({ where: { id: f.id } });
    expect(await repo.findById(p.id)).toBeNull();
    expect(await prisma.ndviScene.count({ where: { id: s.id } })).toBe(0);
    expect(await prisma.alert.count({ where: { sceneId: s.id } })).toBe(0);
    expect(await prisma.$queryRaw`SELECT 1 FROM zone WHERE "sceneId" = ${s.id}::uuid`).toHaveLength(0);
  });

  it('transação de import faz rollback total', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await repo.insert(farmId, 'T1', sq(-52, -12, 0.01), tx);
        await repo.insert(farmId, 'T2', bowtie, tx);
      }),
    ).rejects.toThrow();
    expect((await repo.findByFarm(farmId)).some((r) => r.name === 'T1')).toBe(false);
  });
});
