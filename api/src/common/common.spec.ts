import { Body, Controller, Get, INestApplication, Logger, Post, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsNotEmpty } from 'class-validator';
import request from 'supertest';
import { AppException } from './errors';
import { HttpExceptionFilter } from './http-exception.filter';
import { PaginationDto } from './pagination.dto';
import { createValidationPipe } from './validation';

class BodyDto {
  @IsNotEmpty({ message: 'name é obrigatório' })
  name: string;
}

@Controller('t')
class TController {
  @Get('page') page(@Query() q: PaginationDto) {
    return q;
  }
  @Post('body') body(@Body() b: BodyDto) {
    return b;
  }
  @Get('app') app() {
    throw new AppException('FARM_EXISTS', 'já existe');
  }
  @Get('boom') boom() {
    throw new Error('secret stack');
  }
}

describe('common', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const mod = await Test.createTestingModule({ controllers: [TController] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });
  afterAll(() => app.close());

  it('AppException no formato padrão', async () => {
    const r = await request(app.getHttpServer()).get('/t/app').expect(409);
    expect(r.body).toEqual({ statusCode: 409, code: 'FARM_EXISTS', message: 'já existe' });
  });

  it('validação 400 com details', async () => {
    const r = await request(app.getHttpServer()).post('/t/body').send({}).expect(400);
    expect(r.body).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      details: [{ field: 'name', message: 'name é obrigatório' }],
    });
  });

  it('404 de rota inexistente', async () => {
    const r = await request(app.getHttpServer()).get('/nada').expect(404);
    expect(r.body.code).toBe('NOT_FOUND');
  });

  it('erro desconhecido: 500 INTERNAL sem stack', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const r = await request(app.getHttpServer()).get('/t/boom').expect(500);
    expect(r.body).toEqual({ statusCode: 500, code: 'INTERNAL', message: 'Erro interno do servidor' });
    expect(JSON.stringify(r.body)).not.toContain('secret');
  });

  it('pageSize padrão 20, máx 100', async () => {
    const ok = await request(app.getHttpServer()).get('/t/page').expect(200);
    expect(ok.body).toEqual({ page: 1, pageSize: 20 });
    await request(app.getHttpServer()).get('/t/page?pageSize=101').expect(400);
    await request(app.getHttpServer()).get('/t/page?pageSize=100&page=2').expect(200);
  });
});
