import { Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NotificationsService } from '../src/notifications/notifications.service';

describe('notifications-privacy', () => {
  it('log não contém dígitos do telefone', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const svc = new NotificationsService({ findById: async () => ({ id: 'a' }) } as any);
    await svc.whatsapp('a', '+5586999991234');
    const line = String(log.mock.calls[0][0]);
    expect(line).toContain('"phone":"***"');
    expect(line).not.toMatch(/9999|1234/);
  });

  it('schema sem coluna phone', () => {
    expect(readFileSync(join(__dirname, '../prisma/schema.prisma'), 'utf8')).not.toMatch(/\bphone\b/i);
  });
});
