import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AlertsModule } from '../alerts/alerts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PlotsModule } from '../plots/plots.module';
import { ZonesModule } from '../zones/zones.module';
import { JobsController } from './jobs.controller';
import { JobsProcessor, WORKER_FACTORY, consumerFactory } from './jobs.processor';
import { JOBS_QUEUE, JobsService, QUEUE_NAME } from './jobs.service';
import { ReportRunner } from '../reports/report.runner';
import { ResultPersister } from './result.persister';
import { WorkerClient } from './worker.client';

@Module({
  imports: [PlotsModule, AlertsModule, ZonesModule, NotificationsModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobsProcessor,
    ResultPersister,
    ReportRunner,
    WorkerClient,
    { provide: JOBS_QUEUE, useFactory: () => new Queue(QUEUE_NAME, { connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' } }) },
    { provide: WORKER_FACTORY, useFactory: consumerFactory },
  ],
  exports: [JobsService, WorkerClient, JOBS_QUEUE],
})
export class JobsModule {}
