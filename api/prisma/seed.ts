import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PlotsRepository } from '../src/plots/plots.repository';

const prisma = new PrismaClient();
const FARM = 'Fazenda Demo Uruçuí';

async function main() {
  const fc = JSON.parse(readFileSync(process.env.SEED_GEOJSON ?? join(__dirname, '../../worker/fixtures/demo-plots.geojson'), 'utf8'));
  const farm = await prisma.farm.upsert({
    where: { name: FARM },
    update: {},
    create: { name: FARM, municipality: 'Uruçuí', state: 'PI' },
  });
  const repo = new PlotsRepository(prisma as any);
  const existing = new Set((await repo.findByFarm(farm.id, prisma)).map((p) => p.name));
  for (const f of fc.features) {
    if (!existing.has(f.properties.name)) await repo.insert(farm.id, f.properties.name, f.geometry, prisma);
  }
}

main().finally(() => prisma.$disconnect());
