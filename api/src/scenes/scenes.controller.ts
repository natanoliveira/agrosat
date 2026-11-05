import { Controller, Get, Param, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';
import { UuidPipe } from '../common/errors';
import { ScenesService } from './scenes.service';

export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export class ScenesQuery {
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean({ message: 'valid deve ser true ou false' })
  valid?: boolean;
}

export class PixelQuery {
  @Matches(DATE_RE, { message: 'date deve estar no formato YYYY-MM-DD' })
  date: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'lng deve ser numérico' })
  @Min(-180, { message: 'lng deve estar entre -180 e 180' })
  @Max(180, { message: 'lng deve estar entre -180 e 180' })
  lng: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'lat deve ser numérico' })
  @Min(-90, { message: 'lat deve estar entre -90 e 90' })
  @Max(90, { message: 'lat deve estar entre -90 e 90' })
  lat: number;
}

@Controller('plots/:id')
export class ScenesController {
  constructor(private readonly scenes: ScenesService) {}

  @Get('scenes') list(@Param('id', UuidPipe) id: string, @Query() q: ScenesQuery) {
    return this.scenes.list(id, q.valid === true);
  }

  @Get('pixel') pixel(@Param('id', UuidPipe) id: string, @Query() q: PixelQuery) {
    return this.scenes.pixel(id, q.date, q.lng, q.lat);
  }
}
