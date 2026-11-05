import { Injectable } from '@nestjs/common';
import { AppException, notFound } from '../common/errors';
import { WorkerClient, WorkerError } from '../jobs/worker.client';
import { PrismaService } from '../prisma/prisma.service';

export class SceneDto {
  date: string;
  valid: boolean;
  validPct: number;
  mean: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  pngUrl: string | null;
  bounds: unknown;
  source: string;
}

const filesUrl = (rel: string | null) =>
  rel ? `${(process.env.PUBLIC_FILES_URL ?? 'http://localhost:3001/api/v1/files').replace(/\/$/, '')}/${rel}` : null;

@Injectable()
export class ScenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: WorkerClient,
  ) {}

  private async assertPlot(plotId: string) {
    if (!(await this.prisma.plot.count({ where: { id: plotId } }))) throw notFound('Talhão');
  }

  async list(plotId: string, validOnly: boolean): Promise<SceneDto[]> {
    await this.assertPlot(plotId);
    const rows = await this.prisma.ndviScene.findMany({
      where: { plotId, ...(validOnly && { valid: true }) },
      orderBy: { sceneDate: 'asc' },
    });
    return rows.map((r) => ({
      date: r.sceneDate.toISOString().slice(0, 10),
      valid: r.valid,
      validPct: Number(r.validPct),
      mean: r.mean,
      median: r.median,
      p10: r.p10,
      p90: r.p90,
      pngUrl: filesUrl(r.pngPath),
      bounds: r.bounds,
      source: r.source,
    }));
  }

  async pixel(plotId: string, date: string, lng: number, lat: number): Promise<{ ndvi: number | null }> {
    await this.assertPlot(plotId);
    const scene = await this.prisma.ndviScene.findUnique({
      where: { plotId_sceneDate: { plotId, sceneDate: new Date(`${date}T00:00:00Z`) } },
      select: { ndviPath: true },
    });
    if (!scene) throw new AppException('SCENE_NOT_FOUND', 'Cena não encontrada para a data informada');
    if (!scene.ndviPath) return { ndvi: null };
    try {
      return { ndvi: (await this.worker.pixel({ ndviPath: scene.ndviPath, lng, lat })).ndvi };
    } catch (e) {
      if (e instanceof WorkerError && e.status === 404) return { ndvi: null };
      throw e;
    }
  }
}
