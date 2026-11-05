import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { UuidPipe } from '../common/errors';
import { JobsService } from './jobs.service';

@Controller()
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post('plots/:id/process') @HttpCode(202) async process(@Param('id', UuidPipe) id: string) {
    return { jobId: await this.jobs.enqueue(id) };
  }

  @Get('jobs/:id') get(@Param('id', UuidPipe) id: string) {
    return this.jobs.get(id);
  }
}
