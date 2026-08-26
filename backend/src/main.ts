import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { FileLogger } from './common/logger/file-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new FileLogger() });
  // maxAge lets the browser cache the CORS preflight (OPTIONS) response —
  // without it, every single request pays a separate ~250-300ms round trip
  // just to re-confirm the same CORS permissions the browser already has.
  //
  // localhost:3000 stays allowed always (normal desktop dev flow) — FRONTEND_URL
  // is ADDED on top of it, not a replacement, so pointing it at a LAN IP to test
  // from a phone doesn't break the everyday localhost browser.
  const allowedOrigins = new Set(['http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean));
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      callback(null, !origin || allowedOrigins.has(origin));
    },
    maxAge: 86400,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // The OpenAPI document also feeds the MCP tool registry (derives tool
  // schemas from the same spec) — generated in every env since that's cheap
  // and in-memory. Only the browsable HTML UI is gated to non-prod: we don't
  // want the full API map publicly navigable in production.
  const swaggerDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Pizzería Pippo API')
      .setDescription('API del backend de gestión multi-sucursal')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api-docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
