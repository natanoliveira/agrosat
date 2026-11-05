import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { JobsModule } from '../jobs/jobs.module';
import { DashboardService } from './dashboard.service';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';

@Module({ imports: [FilesModule, JobsModule], controllers: [FarmsController], providers: [FarmsService, DashboardService] })
export class FarmsModule {}
