import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { PlotsImportController } from './plots-import.controller';
import { PlotsController } from './plots.controller';
import { PlotsRepository } from './plots.repository';
import { PlotsService } from './plots.service';

@Module({
  imports: [FilesModule],
  controllers: [PlotsController, PlotsImportController],
  providers: [PlotsService, PlotsRepository],
  exports: [PlotsRepository],
})
export class PlotsModule {}
