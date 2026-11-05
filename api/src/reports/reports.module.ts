import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({ imports: [JobsModule], controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
