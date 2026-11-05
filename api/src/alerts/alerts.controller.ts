import { Controller, Get, Query } from '@nestjs/common';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../common/pagination.dto';
import { AlertsService } from './alerts.service';

export class AlertsQuery extends PaginationDto {
  @IsOptional() @IsUUID('all', { message: 'farmId deve ser um UUID' }) farmId?: string;
  @IsOptional() @IsUUID('all', { message: 'plotId deve ser um UUID' }) plotId?: string;
  @IsOptional() @IsIn(['medium', 'high'], { message: 'severity deve ser medium ou high' }) severity?: string;
  @IsOptional() @IsIn(['drop', 'patch'], { message: 'type deve ser drop ou patch' }) type?: string;
}

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get() list(@Query() q: AlertsQuery) {
    return this.alerts.list(q);
  }
}
