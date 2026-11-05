import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { UuidPipe } from '../common/errors';
import { ReportsService } from './reports.service';

@Controller('plots/:id/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post() @HttpCode(202) async create(@Param('id', UuidPipe) id: string) {
    return { jobId: await this.reports.enqueue(id) };
  }

  @Get('latest') latest(@Param('id', UuidPipe) id: string) {
    return this.reports.latest(id);
  }
}
