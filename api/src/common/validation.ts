import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppException, ErrorDetail } from './errors';

const flatten = (errors: ValidationError[], prefix = ''): ErrorDetail[] =>
  errors.flatMap((e) => {
    const field = prefix + e.property;
    return [
      ...Object.values(e.constraints ?? {}).map((message) => ({ field, message })),
      ...flatten(e.children ?? [], `${field}.`),
    ];
  });

export const createValidationPipe = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => new AppException('VALIDATION_ERROR', 'Dados inválidos', flatten(errors)),
  });
