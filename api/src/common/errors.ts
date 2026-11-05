import { HttpException, HttpStatus, ParseUUIDPipe } from '@nestjs/common';

export const ErrorCode = {
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  INVALID_FILE: HttpStatus.BAD_REQUEST,
  NO_POLYGON: HttpStatus.BAD_REQUEST,
  INVALID_GEOMETRY: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  SCENE_NOT_FOUND: HttpStatus.NOT_FOUND,
  FARM_EXISTS: HttpStatus.CONFLICT,
  JOB_IN_PROGRESS: HttpStatus.CONFLICT,
  NO_VALID_SCENE: HttpStatus.UNPROCESSABLE_ENTITY,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
} as const;

export type ErrorCodeName = keyof typeof ErrorCode;

export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCodeName,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message, ErrorCode[code]);
  }
}

export const notFound = (what = 'Recurso') => new AppException('NOT_FOUND', `${what} não encontrado`);

export const UuidPipe = new ParseUUIDPipe({ exceptionFactory: () => notFound() });
