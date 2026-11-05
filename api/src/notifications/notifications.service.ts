import { Injectable, Logger } from '@nestjs/common';
import { AlertsRepository } from '../alerts/alerts.repository';
import { notFound } from '../common/errors';

@Injectable()
export class NotificationsService {
  private readonly log = new Logger('notifications');

  constructor(private readonly alerts: AlertsRepository) {}

  /** Alertas recém-inseridos: marca notifiedAt (só se nulo) e loga. Nada sai da máquina. */
  async notifyNew(alertIds: string[]): Promise<void> {
    for (const alertId of await this.alerts.markNotified(alertIds)) this.emit(alertId);
  }

  async whatsapp(alertId: string, phone?: string): Promise<{ simulated: true }> {
    if (!(await this.alerts.findById(alertId))) throw notFound('Alerta');
    this.emit(alertId, phone);
    return { simulated: true };
  }

  private emit(alertId: string, phone?: string) {
    this.log.log(JSON.stringify({ event: 'notification.simulated', channel: 'whatsapp', alertId, phone: phone ? '***' : undefined }));
  }
}
