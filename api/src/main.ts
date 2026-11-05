import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { assertEnv } from './config';
import { setupApp } from './setup';

async function bootstrap() {
  assertEnv();
  const app = await NestFactory.create(AppModule);
  setupApp(app);
  const doc = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('AgroSat API').setVersion('1').build());
  SwaggerModule.setup('api/docs', app, doc);
  await app.listen(Number(process.env.PORT ?? 3001));
}
bootstrap().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
