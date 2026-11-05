import { Injectable } from '@nestjs/common';
import { notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { FarmDto } from './dto';

export type Trend = 'up' | 'down' | 'flat';
const FLAT = 0.02;

interface Row {
  id: string;
  name: string;
  areaHa: number;
  needsReprocess: boolean;
  means: number[] | null;
  alertId: string | null;
  alertType: string | null;
  alertSeverity: string | null;
  alertDate: string | null;
  alertValue: number | null;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(farmId: string) {
    const farm = await this.prisma.farm.findUnique({ where: { id: farmId } });
    if (!farm) throw notFound('Fazenda');
    // uma query só: últimas 2 médias válidas e último alerta por talhão (LATERAL, sem N+1)
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT p.id, p.name, p."areaHa"::float8 AS "areaHa", p."needsReprocess", s.means,
             a.id AS "alertId", a.type::text AS "alertType", a.severity::text AS "alertSeverity",
             to_char(a."sceneDate", 'YYYY-MM-DD') AS "alertDate", a.value AS "alertValue"
      FROM plot p
      LEFT JOIN LATERAL (
        SELECT array_agg(mean ORDER BY "sceneDate" DESC) AS means
        FROM (SELECT mean, "sceneDate" FROM ndvi_scene WHERE "plotId" = p.id AND valid ORDER BY "sceneDate" DESC LIMIT 2) x
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT id, type, severity, "sceneDate", value FROM alert WHERE "plotId" = p.id
        ORDER BY "sceneDate" DESC, "createdAt" DESC LIMIT 1
      ) a ON true
      WHERE p."farmId" = ${farmId}::uuid
      ORDER BY p.name, p.id`;
    return {
      farm: FarmDto.from(farm),
      plots: rows.map((r) => {
        const [cur, prev] = r.means ?? [];
        return {
          id: r.id,
          name: r.name,
          areaHa: r.areaHa,
          needsReprocess: r.needsReprocess,
          currentNdvi: cur ?? null,
          trend: cur === undefined || prev === undefined ? null : trend(cur - prev),
          lastAlert: r.alertId ? { id: r.alertId, type: r.alertType, severity: r.alertSeverity, date: r.alertDate, value: r.alertValue } : null,
        };
      }),
    };
  }
}

export const trend = (delta: number): Trend => (Math.abs(delta) < FLAT ? 'flat' : delta > 0 ? 'up' : 'down');
