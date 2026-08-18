import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { FileLogger } from './common/logger/file-logger.service';
import { ToolRegistryService } from './ai-chat/tool-registry/tool-registry.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new FileLogger() });
  // maxAge lets the browser cache the CORS preflight (OPTIONS) response —
  // without it, every single request pays a separate ~250-300ms round trip
  // just to re-confirm the same CORS permissions the browser already has.
  //
  // localhost:3000 stays allowed always (normal desktop dev flow) — FRONTEND_URL
  // is ADDED on top of it, not a replacement, so pointing it at a LAN IP to test
  // from a phone doesn't break the everyday localhost browser.
  const allowedOrigins = new Set(
    ['http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, !origin || allowedOrigins.has(origin));
    },
    maxAge: 86400,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  // El documento se genera siempre (barato, en memoria) — ToolRegistryService
  // lo necesita en cualquier entorno para derivar las tools del chat de IA.
  // Solo la UI HTML en /api-docs queda gateada a dev/staging: no queremos el
  // mapa completo de la API navegable en producción.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Pizzería Pippo API')
    .setDescription('API del backend de gestión multi-sucursal')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  app.get(ToolRegistryService).loadDocument(swaggerDocument);

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api-docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3333);
}
bootstrap();
