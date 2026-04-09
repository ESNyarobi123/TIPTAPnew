import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const uploadRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadRoot)) {
    mkdirSync(uploadRoot, { recursive: true });
  }
  app.useStaticAssets(uploadRoot, { prefix: '/api/v1/files/' });

  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
    ],
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = app.get(ConfigService);
  const corsOrigins = config.get<string>('app.corsOrigins');
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim()).filter(Boolean)
      : ['http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
  });
  const swaggerEnabled = config.get<boolean>('swagger.enabled');
  if (swaggerEnabled) {
    const swaggerPath = config.get<string>('swagger.path') ?? 'docs';
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TipTap API')
      .setDescription(
        'Multi-tenant service-commerce backend (FOOD_DINING, BEAUTY_GROOMING). HTTP routes use global prefix `/api/v1` (see each path). `/health` and `/ready` are unversioned.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(swaggerPath, app, document, {
      jsonDocumentUrl: `${swaggerPath}/json`,
    });
  }

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
}

bootstrap();
