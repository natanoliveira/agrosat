import { Controller, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AppException, UuidPipe } from '../common/errors';
import { MAX_FILE_BYTES } from '../common/geo';
import { PlotsService } from './plots.service';

@Controller('farms/:farmId/plots/import')
export class PlotsImportController {
  constructor(private readonly plots: PlotsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } }))
  import(@Param('farmId', UuidPipe) farmId: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new AppException('INVALID_FILE', 'Envie um arquivo no campo "file"');
    return this.plots.importItems(farmId, file.originalname, file.buffer);
  }
}
