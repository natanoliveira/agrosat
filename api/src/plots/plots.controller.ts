import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { UuidPipe } from '../common/errors';
import { CreatePlotDto, UpdatePlotDto } from './dto';
import { PlotsService } from './plots.service';

@Controller()
export class PlotsController {
  constructor(private readonly plots: PlotsService) {}

  @Get('farms/:farmId/plots') list(@Param('farmId', UuidPipe) farmId: string) {
    return this.plots.listByFarm(farmId);
  }

  @Post('farms/:farmId/plots') create(@Param('farmId', UuidPipe) farmId: string, @Body() dto: CreatePlotDto) {
    return this.plots.create(farmId, dto);
  }

  @Get('plots/:id') get(@Param('id', UuidPipe) id: string) {
    return this.plots.get(id);
  }

  @Patch('plots/:id') update(@Param('id', UuidPipe) id: string, @Body() dto: UpdatePlotDto) {
    return this.plots.update(id, dto);
  }

  @Delete('plots/:id') @HttpCode(204) async remove(@Param('id', UuidPipe) id: string) {
    await this.plots.remove(id);
  }
}
