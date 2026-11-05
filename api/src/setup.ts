import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { createValidationPipe } from './common/validation';

export function setupApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  // arquivos (PNG/PDF) são carregados pelo web em outra origem
  app.use('/api/v1/files', (_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  });
  app.enableCors({ origin: (origin, cb) => cb(null, !origin || origin === (process.env.WEB_ORIGIN ?? 'http://localhost:3005')) });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
}
