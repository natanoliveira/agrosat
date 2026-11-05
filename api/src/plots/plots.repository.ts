import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Polygon } from '../common/geo';
import { PrismaService } from '../prisma/prisma.service';

export type Db = PrismaService | Prisma.TransactionClient;

export interface PlotRow {
  id: string;
  farmId: string;
  name: string;
  areaHa: number;
  needsReprocess: boolean;
  geometry: Polygon;
}

const COLS = Prisma.sql`id, "farmId", name, "areaHa"::float8 AS "areaHa", "needsReprocess", ST_AsGeoJSON(geom)::json AS geometry`;
const GEOM = (g: Polygon) => Prisma.sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(g)}), 4326)`;

@Injectable()
export class PlotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isValid(g: Polygon, db: Db = this.prisma): Promise<boolean> {
    try {
      const [r] = await db.$queryRaw<{ ok: boolean }[]>`SELECT ST_IsValid(${GEOM(g)}) AS ok`;
      return r.ok;
    } catch {
      return false;
    }
  }

  async insert(farmId: string, name: string, g: Polygon, db: Db = this.prisma): Promise<PlotRow> {
    const [row] = await db.$queryRaw<PlotRow[]>`
      WITH g AS (SELECT ${GEOM(g)} AS geom)
      INSERT INTO plot (id, "farmId", name, geom, "areaHa", "createdAt", "updatedAt")
      SELECT gen_random_uuid(), ${farmId}::uuid, ${name}, geom, ST_Area(geom::geography) / 10000, now(), now() FROM g
      RETURNING ${COLS}`;
    return row;
  }

  async update(id: string, patch: { name?: string; geometry?: Polygon }, db: Db = this.prisma): Promise<PlotRow | null> {
    const sets: Prisma.Sql[] = [Prisma.sql`"updatedAt" = now()`];
    if (patch.name !== undefined) sets.push(Prisma.sql`name = ${patch.name}`);
    if (patch.geometry) {
      sets.push(
        Prisma.sql`geom = ${GEOM(patch.geometry)}`,
        Prisma.sql`"areaHa" = ST_Area(${GEOM(patch.geometry)}::geography) / 10000`,
        Prisma.sql`"needsReprocess" = true`,
      );
    }
    const [row] = await db.$queryRaw<PlotRow[]>`
      UPDATE plot SET ${Prisma.join(sets)} WHERE id = ${id}::uuid RETURNING ${COLS}`;
    return row ?? null;
  }

  findById(id: string, db: Db = this.prisma): Promise<PlotRow | null> {
    return db.$queryRaw<PlotRow[]>`SELECT ${COLS} FROM plot WHERE id = ${id}::uuid`.then((r) => r[0] ?? null);
  }

  findByFarm(farmId: string, db: Db = this.prisma): Promise<PlotRow[]> {
    return db.$queryRaw<PlotRow[]>`SELECT ${COLS} FROM plot WHERE "farmId" = ${farmId}::uuid ORDER BY name, id`;
  }

  async delete(id: string, db: Db = this.prisma): Promise<boolean> {
    return (await db.$executeRaw`DELETE FROM plot WHERE id = ${id}::uuid`) > 0;
  }
}
