import { Injectable } from '@nestjs/common';
import { AlertsRepository } from '../alerts/alerts.repository';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesRepository } from '../zones/zones.repository';
import { ProcessResponse } from './worker.client';

export interface Window {
  dateFrom: string;
  dateTo: string;
}

@Injectable()
export class ResultPersister {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zones: ZonesRepository,
    private readonly alerts: AlertsRepository,
  ) {}

  /** Grava tudo numa transação; devolve ids dos alertas inseridos (primeira vez). */
  async persist(plotId: string, win: Window, res: ProcessResponse, readAt: Date): Promise<string[]> {
    const day = (d: string) => new Date(`${d}T00:00:00Z`);
    return this.prisma.$transaction(
      async (tx) => {
        const inserted: string[] = [];
        const keep: { date: string; type: string }[] = [];
        for (const s of res.scenes) {
          const data = {
            source: res.source,
            valid: s.valid,
            validPct: s.validPct,
            mean: s.stats?.mean ?? null,
            median: s.stats?.median ?? null,
            p10: s.stats?.p10 ?? null,
            p90: s.stats?.p90 ?? null,
            pngPath: s.valid ? s.pngPath : null,
            ndviPath: s.valid ? s.ndviPath : null,
            bounds: s.bounds,
          };
          const scene = await tx.ndviScene.upsert({
            where: { plotId_sceneDate: { plotId, sceneDate: day(s.date) } },
            create: { plotId, sceneDate: day(s.date), ...data },
            update: data,
            select: { id: true },
          });
          const feats = s.valid ? (s.zones?.features ?? []) : [];
          await this.zones.replaceForScene(tx, scene.id, feats.map((f) => ({ class: f.properties.class, areaHa: f.properties.areaHa, geometry: f.geometry })));
          for (const a of s.valid ? s.alerts : []) {
            const r = await this.alerts.upsert(tx, plotId, scene.id, s.date, a);
            keep.push({ date: s.date, type: a.type });
            if (r.inserted) inserted.push(r.id);
          }
        }
        await tx.ndviScene.deleteMany({
          where: { plotId, sceneDate: { gte: day(win.dateFrom), lte: day(win.dateTo), notIn: res.scenes.map((s) => day(s.date)) } },
        });
        await this.alerts.deleteMissingInWindow(tx, plotId, win.dateFrom, win.dateTo, keep);
        await tx.$executeRaw`UPDATE plot SET "needsReprocess" = false WHERE id = ${plotId}::uuid AND "updatedAt" <= ${readAt}`;
        return inserted;
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  }
}
