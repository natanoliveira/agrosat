import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { Response } from 'express';
import { UuidPipe } from '../common/errors';
import { DATE_RE } from '../scenes/scenes.controller';
import { ZonesService } from './zones.service';

export class ZonesQuery {
  @IsOptional()
  @Matches(DATE_RE, { message: 'date deve estar no formato YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsIn(['1'], { message: 'download deve ser 1' })
  download?: string;
}

@Controller('plots/:id/zones')
export class ZonesController {
  constructor(private readonly zones: ZonesService) {}

  @Get() async get(@Param('id', UuidPipe) id: string, @Query() q: ZonesQuery, @Res({ passthrough: true }) res: Response) {
    const { filename, collection } = await this.zones.get(id, q.date);
    if (q.download) res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return collection;
  }
}
