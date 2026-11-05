import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Db } from '../plots/plots.repository';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertIn {
  type: 'drop' | 'patch';
  severity: 'medium' | 'high';
  value: number;
  geometry: unknown | null;
}

export interface AlertRow {
  id: string;
  plotId: string;
  plotName: string;
  date: string;
  type: 'drop' | 'patch';
  severity: 'medium' | 'high';
  value: number;
  geometry: unknown | null;
}

export interface AlertFilter {
  farmId?: string;
  plotId?: string;
  severity?: string;
  type?: string;
}

@Injectable()
export class AlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(db: Db, plotId: string, sceneId: string, date: string, a: AlertIn): Promise<{ id: string; inserted: boolean }> {
    const geom = a.geometry ? Prisma.sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(a.geometry)}), 4326)` : Prisma.sql`NULL`;
    const [row] = await db.$queryRaw<{ id: string; inserted: boolean }[]>`
      INSERT INTO alert (id, "plotId", "sceneId", "sceneDate", type, severity, value, geom, "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${plotId}::uuid, ${sceneId}::uuid, ${date}::date, ${a.type}::"AlertType", ${a.severity}::"Severity", ${a.value}, ${geom}, now(), now())
      ON CONFLICT ("plotId", "sceneDate", type) DO UPDATE
        SET "sceneId" = EXCLUDED."sceneId", severity = EXCLUDED.severity, value = EXCLUDED.value, geom = EXCLUDED.geom, "updatedAt" = now()
      RETURNING id, (xmax = 0) AS inserted`;
    return row;
  }

  async deleteMissingInWindow(db: Db, plotId: string, from: string, to: string, keep: { date: string; type: string }[]): Promise<void> {
    const keys = keep.map((k) => `${k.date}|${k.type}`);
    await db.$executeRaw`
      DELETE FROM alert
      WHERE "plotId" = ${plotId}::uuid AND "sceneDate" BETWEEN ${from}::date AND ${to}::date
        AND (to_char("sceneDate", 'YYYY-MM-DD') || '|' || type::text) <> ALL(${keys}::text[])`;
  }

  async markNotified(ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      UPDATE alert SET "notifiedAt" = now() WHERE id = ANY(${ids}::uuid[]) AND "notifiedAt" IS NULL RETURNING id`;
    return rows.map((r) => r.id);
  }

  private where(f: AlertFilter) {
    const c: Prisma.Sql[] = [];
    if (f.farmId) c.push(Prisma.sql`p."farmId" = ${f.farmId}::uuid`);
    if (f.plotId) c.push(Prisma.sql`a."plotId" = ${f.plotId}::uuid`);
    if (f.severity) c.push(Prisma.sql`a.severity = ${f.severity}::"Severity"`);
    if (f.type) c.push(Prisma.sql`a.type = ${f.type}::"AlertType"`);
    return c.length ? Prisma.sql`WHERE ${Prisma.join(c, ' AND ')}` : Prisma.empty;
  }

  async list(f: AlertFilter, page: number, pageSize: number): Promise<{ rows: AlertRow[]; total: number }> {
    const where = this.where(f);
    const [rows, [{ total }]] = await Promise.all([
      this.prisma.$queryRaw<AlertRow[]>`
        SELECT a.id, a."plotId", p.name AS "plotName", to_char(a."sceneDate", 'YYYY-MM-DD') AS date, a.type::text AS type,
               a.severity::text AS severity, a.value, ST_AsGeoJSON(a.geom)::json AS geometry
        FROM alert a JOIN plot p ON p.id = a."plotId" ${where}
        ORDER BY a."sceneDate" DESC, a."createdAt" DESC, a.id
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT count(*)::int AS total FROM alert a JOIN plot p ON p.id = a."plotId" ${where}`,
    ]);
    return { rows, total };
  }

  findById(id: string) {
    return this.prisma.alert.findUnique({ where: { id }, select: { id: true, type: true, severity: true, plotId: true } });
  }
}
