import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FarmsService } from '../../src/farms/farms.service';
import { FilesService } from '../../src/files/files.service';
import { PlotsRepository } from '../../src/plots/plots.repository';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('farm delete', () => {
  const prisma = new PrismaService();
  const svc = new FarmsService(prisma, new FilesService());
  const dir = mkdtempSync(join(tmpdir(), 'agrosat-'));
  beforeAll(() => { process.env.DATA_DIR = dir; });
  afterAll(() => prisma.$disconnect());

  it('apaga filhos no banco e pastas do volume', async () => {
    const farm = await prisma.farm.create({ data: { name: `int-del-${Date.now()}`, municipality: 'X', state: 'PI' } });
    const ring = [[-44.5, -7.2], [-44.49, -7.2], [-44.49, -7.19], [-44.5, -7.19], [-44.5, -7.2]];
    const { id: plotId } = await new PlotsRepository(prisma).insert(farm.id, 'P', { type: 'Polygon', coordinates: [ring] });
    for (const sub of ['plots', 'reports']) {
      mkdirSync(join(dir, sub, plotId), { recursive: true });
      writeFileSync(join(dir, sub, plotId, 'f'), 'x');
    }
    await svc.remove(farm.id);
    expect(await prisma.plot.count({ where: { farmId: farm.id } })).toBe(0);
    expect(existsSync(join(dir, 'plots', plotId))).toBe(false);
    expect(existsSync(join(dir, 'reports', plotId))).toBe(false);
  });
});
