import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get('*')
  async get(@Param('0') rel: string, @Res() res: Response) {
    res.sendFile(await this.files.resolveFile(rel));
  }
}
