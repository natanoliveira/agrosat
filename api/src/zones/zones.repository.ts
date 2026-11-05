import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db } from '../plots/plots.repository';
import { PrismaService } from '../prisma/prisma.service';

export interface ZoneIn {
  class: 'low' | 'medium' | 'high';
  areaHa: number;
  geometry: unknown;
}

export interface ZoneRow {
  class: 'low' | 'medium' | 'high';
  areaHa: number;
  geometry: { type: string; coordinates: unknown };
}

@Injectable()
export class ZonesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replaceForScene(db: Db, sceneId: string, zones: ZoneIn[]): Promise<void> {
    await db.$executeRaw`DELETE FROM zone WHERE "sceneId" = ${sceneId}::uuid AND class::text <> ALL(${zones.map((z) => z.class)}::text[])`;
    if (!zones.length) return;
    const values = zones.map(
      (z) => Prisma.sql`(gen_random_uuid(), ${sceneId}::uuid, ${z.class}::"ZoneClass", ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(z.geometry)}), 4326)), ${z.areaHa}, now(), now())`,
    );
    await db.$executeRaw`
      INSERT INTO zone (id, "sceneId", class, geom, "areaHa", "createdAt", "updatedAt")
      VALUES ${Prisma.join(values)}
      ON CONFLICT ("sceneId", class) DO UPDATE SET geom = EXCLUDED.geom, "areaHa" = EXCLUDED."areaHa", "updatedAt" = now()`;
  }

  findByScene(sceneId: string): Promise<ZoneRow[]> {
    return this.prisma.$queryRaw<ZoneRow[]>`
      SELECT class::text AS class, "areaHa"::float8 AS "areaHa", ST_AsGeoJSON(geom)::json AS geometry
      FROM zone WHERE "sceneId" = ${sceneId}::uuid
      ORDER BY CASE class WHEN 'low' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`;
  }
}
