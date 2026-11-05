import { Module } from '@nestjs/common';
import { ZonesController } from './zones.controller';
import { ZonesRepository } from './zones.repository';
import { ZonesService } from './zones.service';

@Module({ controllers: [ZonesController], providers: [ZonesService, ZonesRepository], exports: [ZonesRepository] })
export class ZonesModule {}
