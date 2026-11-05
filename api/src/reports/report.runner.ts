import { Injectable } from '@nestjs/common';
import { dirname } from 'path';
import { AlertsRepository } from '../alerts/alerts.repository';
import { PlotsRepository } from '../plots/plots.repository';
import { PrismaService } from '../prisma/prisma.service';
import { WorkerClient, WorkerError } from '../jobs/worker.client';

@Injectable()
export class ReportRunner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plots: PlotsRepository,
    private readonly alerts: AlertsRepository,
    private readonly worker: WorkerClient,
  ) {}

  async run(jobId: string, plotId: string): Promise<{ reportId: string }> {
    const plot = await this.plots.findById(plotId);
    if (!plot) throw new WorkerError('NOT_FOUND', 'Talhão não encontrado');
    const scenes = await this.prisma.ndviScene.findMany({ where: { plotId, valid: true, pngPath: { not: null } }, orderBy: { sceneDate: 'asc' } });
    const latest = scenes[scenes.length - 1];
    if (!latest) throw new WorkerError('NO_VALID_SCENE', 'Talhão sem cena válida para gerar relatório', 422);
    const { rows } = await this.alerts.list({ plotId }, 1, 1000);
    const { pdfPath } = await this.worker.report({
      plot: { id: plot.id, name: plot.name, areaHa: plot.areaHa, geometry: plot.geometry },
      scenes: scenes.map((s) => ({ date: s.sceneDate.toISOString().slice(0, 10), mean: s.mean, median: s.median, p10: s.p10, p90: s.p90 })),
      alerts: rows,
      latest: { pngPath: latest.pngPath!, bounds: latest.bounds as number[][], zonesPath: `${dirname(latest.pngPath!)}/zones.geojson` },
    });
    const r = await this.prisma.report.create({ data: { plotId, jobId, pdfPath }, select: { id: true } });
    return { reportId: r.id };
  }
}
