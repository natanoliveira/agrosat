import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { AppException, ErrorCodeName } from './errors';

const BY_STATUS: Record<number, ErrorCodeName> = {
  400: 'VALIDATION_ERROR',
  404: 'NOT_FOUND',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      return res.status(exception.getStatus()).json({
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.details && { details: exception.details }),
      });
    }

    if (exception instanceof HttpException) {
      const tooLarge = exception.getStatus() === HttpStatus.PAYLOAD_TOO_LARGE;
      const statusCode = tooLarge ? HttpStatus.BAD_REQUEST : exception.getStatus();
      const code = tooLarge ? 'INVALID_FILE' : (BY_STATUS[statusCode] ?? 'INTERNAL');
      const message = tooLarge
        ? 'Arquivo excede o limite de 5 MB'
        : statusCode === 404
          ? 'Recurso não encontrado'
          : exception.message;
      return res.status(statusCode).json({ statusCode, code, message });
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    return res.status(statusCode).json({ statusCode, code: 'INTERNAL', message: 'Erro interno do servidor' });
  }
}
