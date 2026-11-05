import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FilesService } from '../src/files/files.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupApp } from '../src/setup';
import { PlotsController } from '../src/plots/plots.controller';
import { PlotsImportController } from '../src/plots/plots-import.controller';
import { PlotsRepository } from '../src/plots/plots.repository';
import { PlotsService } from '../src/plots/plots.service';

export const FARM = '11111111-1111-4111-8111-111111111111';
export const PLOT = '22222222-2222-4222-8222-222222222222';
export const geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
export const row = (o = {}) => ({ id: PLOT, farmId: FARM, name: 'T1', areaHa: 12.5, needsReprocess: false, geometry, ...o });

export async function plotsApp() {
  const prisma: any = {
    farm: { count: jest.fn().mockResolvedValue(1) },
    $transaction: jest.fn((cb: any) => cb({})),
  };
  const repo = {
    isValid: jest.fn().mockResolvedValue(true),
    insert: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findByFarm: jest.fn(),
    delete: jest.fn(),
  };
  const files = { removePlotDirs: jest.fn().mockResolvedValue(undefined) };
  const mod = await Test.createTestingModule({
    controllers: [PlotsController, PlotsImportController],
    providers: [
      PlotsService,
      { provide: PrismaService, useValue: prisma },
      { provide: PlotsRepository, useValue: repo },
      { provide: FilesService, useValue: files },
    ],
  }).compile();
  const app: INestApplication = mod.createNestApplication();
  setupApp(app);
  await app.init();
  return { app, prisma, repo, files };
}

