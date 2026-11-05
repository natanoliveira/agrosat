import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FarmsModule } from './farms/farms.module';
import { FilesModule } from './files/files.module';
import { AlertsModule } from './alerts/alerts.module';
import { HealthController } from './health.controller';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlotsModule } from './plots/plots.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { ScenesModule } from './scenes/scenes.module';
import { ZonesModule } from './zones/zones.module';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000, limit: Number(process.env.THROTTLE_LIMIT ?? 600) }]), PrismaModule, FilesModule, FarmsModule, PlotsModule, JobsModule, ScenesModule, ZonesModule, AlertsModule, NotificationsModule, ReportsModule],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
