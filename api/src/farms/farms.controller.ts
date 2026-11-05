import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';
import { UuidPipe } from '../common/errors';
import { PaginationDto } from '../common/pagination.dto';
import { DashboardService } from './dashboard.service';
import { CreateFarmDto, UpdateFarmDto } from './dto';
import { FarmsService } from './farms.service';

@Controller('farms')
export class FarmsController {
  constructor(
    private readonly farms: FarmsService,
    private readonly dashboard: DashboardService,
    private readonly jobs: JobsService,
  ) {}

  @Get() list(@Query() p: PaginationDto) {
    return this.farms.list(p);
  }

  @Post() create(@Body() dto: CreateFarmDto) {
    return this.farms.create(dto);
  }

  @Get(':id') get(@Param('id', UuidPipe) id: string) {
    return this.farms.get(id);
  }

  @Get(':id/dashboard') getDashboard(@Param('id', UuidPipe) id: string) {
    return this.dashboard.get(id);
  }

  @Post(':id/process') @HttpCode(202) async process(@Param('id', UuidPipe) id: string) {
    await this.farms.get(id);
    return { jobIds: await this.jobs.enqueueFarm(id) };
  }

  @Patch(':id') update(@Param('id', UuidPipe) id: string, @Body() dto: UpdateFarmDto) {
    return this.farms.update(id, dto);
  }

  @Delete(':id') @HttpCode(204) async remove(@Param('id', UuidPipe) id: string) {
    await this.farms.remove(id);
  }
}
