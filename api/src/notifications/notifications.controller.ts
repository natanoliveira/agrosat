import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { NotificationsService } from './notifications.service';

export class WhatsappDto {
  @IsUUID('all', { message: 'alertId deve ser um UUID' })
  alertId: string;

  @IsOptional()
  @IsString({ message: 'phone deve ser texto' })
  @Matches(/^\+?\d{10,15}$/, { message: 'phone deve ter de 10 a 15 dígitos' })
  phone?: string;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post('whatsapp') @HttpCode(202) whatsapp(@Body() dto: WhatsappDto) {
    return this.notifications.whatsapp(dto.alertId, dto.phone);
  }
}
