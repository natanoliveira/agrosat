import { Injectable } from '@nestjs/common';
import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import { Prisma } from '@prisma/client';
import { AppException, notFound } from '../common/errors';
import { Paginated, PaginationDto, paginate } from '../common/pagination.dto';
import { FilesService } from '../files/files.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFarmDto, FarmDto, UpdateFarmDto } from './dto';

const isUnique = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
const exists = () => new AppException('FARM_EXISTS', 'Já existe uma fazenda com esse nome');

@Injectable()
export class FarmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list(p: PaginationDto): Promise<Paginated<FarmDto>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.farm.findMany({ orderBy: { name: 'asc' }, skip: (p.page - 1) * p.pageSize, take: p.pageSize }),
      this.prisma.farm.count(),
    ]);
    return paginate(rows.map(FarmDto.from), p, total);
  }

  async create(dto: CreateFarmDto): Promise<FarmDto> {
    try {
      return FarmDto.from(await this.prisma.farm.create({ data: dto }));
    } catch (e) {
      throw isUnique(e) ? exists() : e;
    }
  }

  async get(id: string): Promise<FarmDto> {
    const farm = await this.prisma.farm.findUnique({ where: { id }, include: { _count: { select: { plots: true } } } });
    if (!farm) throw notFound('Fazenda');
    return FarmDto.from(farm);
  }

  async update(id: string, dto: UpdateFarmDto): Promise<FarmDto> {
    try {
      return FarmDto.from(await this.prisma.farm.update({ where: { id }, data: dto }));
    } catch (e) {
      if (isUnique(e)) throw exists();
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound('Fazenda');
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    const plots = await this.prisma.plot.findMany({ where: { farmId: id }, select: { id: true } });
    const { count } = await this.prisma.farm.deleteMany({ where: { id } });
    if (!count) throw notFound('Fazenda');
    await this.files.removePlotDirs(plots.map((p) => p.id));
    const root = resolve(process.env.DATA_DIR ?? '/data');
    await Promise.all(plots.map((p) => rm(join(root, 'reports', p.id), { recursive: true, force: true })));
  }
}
