import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';

@Module({ imports: [JobsModule], controllers: [ScenesController], providers: [ScenesService] })
export class ScenesModule {}
