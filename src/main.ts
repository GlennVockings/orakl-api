import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OraklConfiguration } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  const config =
    app.get<ConfigService<OraklConfiguration, true>>(ConfigService);

  const trustedOrigins = config.get('auth.trustedOrigins', {
    infer: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: trustedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const port = config.get('app.port', {
    infer: true,
  });
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
