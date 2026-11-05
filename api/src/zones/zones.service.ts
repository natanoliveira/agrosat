import { Injectable } from '@nestjs/common';
import { AppException, notFound } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { ZonesRepository } from './zones.repository';

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'talhao';

@Injectable()
export class ZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: ZonesRepository,
  ) {}

  async get(plotId: string, date?: string) {
    const plot = await this.prisma.plot.findUnique({ where: { id: plotId }, select: { name: true } });
    if (!plot) throw notFound('Talhão');
    const scene = await this.prisma.ndviScene.findFirst({
      where: { plotId, valid: true, ...(date && { sceneDate: new Date(`${date}T00:00:00Z`) }) },
      orderBy: { sceneDate: 'desc' },
      select: { id: true, sceneDate: true },
    });
    if (!scene) throw new AppException('SCENE_NOT_FOUND', 'Nenhuma cena válida encontrada para a data informada');
    const sceneDate = scene.sceneDate.toISOString().slice(0, 10);
    const zones = await this.repo.findByScene(scene.id);
    return {
      filename: `zonas-${slug(plot.name)}-${sceneDate}.geojson`,
      collection: {
        type: 'FeatureCollection' as const,
        features: zones.map((z) => ({
          type: 'Feature' as const,
          geometry: z.geometry,
          properties: { class: z.class, areaHa: z.areaHa, date: sceneDate },
        })),
      },
    };
  }
}
