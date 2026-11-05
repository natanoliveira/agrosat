import { Injectable } from '@nestjs/common';
import { AppException, notFound } from '../common/errors';
import { PolygonItem, isValidPolygon, parseGeoFile } from '../common/geo';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlotDto, PlotFeature, UpdatePlotDto, toFeature } from './dto';
import { Db, PlotsRepository } from './plots.repository';

const invalid = () => new AppException('INVALID_GEOMETRY', 'Geometria inválida: envie um Polygon GeoJSON válido');

@Injectable()
export class PlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: PlotsRepository,
    private readonly files: FilesService,
  ) {}

  private async assertValid(geometry: unknown, db: Db = this.prisma) {
    if (!isValidPolygon(geometry) || !(await this.repo.isValid(geometry, db))) throw invalid();
    return geometry;
  }

  private async assertFarm(farmId: string) {
    if (!(await this.prisma.farm.count({ where: { id: farmId } }))) throw notFound('Fazenda');
  }

  async listByFarm(farmId: string): Promise<PlotFeature[]> {
    await this.assertFarm(farmId);
    return (await this.repo.findByFarm(farmId)).map(toFeature);
  }

  async create(farmId: string, dto: CreatePlotDto): Promise<PlotFeature> {
    await this.assertFarm(farmId);
    const geometry = await this.assertValid(dto.geometry);
    return toFeature(await this.repo.insert(farmId, dto.name, geometry));
  }

  async importItems(farmId: string, filename: string, content: Buffer) {
    await this.assertFarm(farmId);
    const { items, ignored } = parseGeoFile(filename, content);
    const base = filename.replace(/\.[^.]+$/, '');
    const created = await this.prisma.$transaction(async (tx) => {
      const out: PlotFeature[] = [];
      for (const [i, item] of items.entries()) {
        const geometry = await this.assertValid(item.geometry, tx);
        out.push(toFeature(await this.repo.insert(farmId, nameOf(item, base, i), geometry, tx)));
      }
      return out;
    });
    return { created, ignored };
  }

  async get(id: string): Promise<PlotFeature> {
    const row = await this.repo.findById(id);
    if (!row) throw notFound('Talhão');
    return toFeature(row);
  }

  async update(id: string, dto: UpdatePlotDto): Promise<PlotFeature> {
    const geometry = dto.geometry === undefined ? undefined : await this.assertValid(dto.geometry);
    const row = await this.repo.update(id, { name: dto.name, geometry });
    if (!row) throw notFound('Talhão');
    return toFeature(row);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.repo.delete(id))) throw notFound('Talhão');
    await this.files.removePlotDirs([id]);
  }
}

const nameOf = (item: PolygonItem, base: string, i: number) => item.name?.trim() || `${base} ${i + 1}`;
