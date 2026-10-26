import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { FileLogger } from './common/logger/file-logger.service';
import { OpenApiDocumentHolder } from './mcp/openapi-document.holder';
import { resolveTrustProxyHops } from './common/utils/trust-proxy';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new FileLogger(),
  });

  // Reads the real client IP from X-Forwarded-For when deployed behind a
  // reverse proxy. See common/utils/trust-proxy.ts for why this is a hop count
  // and not `true` — and what breaks if the number is wrong.
  const trustProxyHops = resolveTrustProxyHops(process.env.TRUST_PROXY_HOPS);
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
  }
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
  app.get(OpenApiDocumentHolder).setDocument(swaggerDocument);

  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('api-docs', app, swaggerDocument);
  }

  await app.listen(process.env.PORT ?? 3333);

  // Said out loud at boot because getting this wrong fails SILENTLY: the app
  // works, and only the per-client rate limit is quietly broken. In production
  // behind a proxy with 0 hops, every public request looks like one client.
  const logger = new Logger('Bootstrap');
  if (trustProxyHops > 0) {
    logger.log(
      `trust proxy = ${trustProxyHops} salto(s) — la IP del cliente se lee de X-Forwarded-For`,
    );
  } else if (process.env.NODE_ENV === 'production') {
    logger.warn(
      'trust proxy DESACTIVADO en producción: si hay un reverse proxy adelante, ' +
        'el rate limit de pedidos online es GLOBAL en vez de por cliente. ' +
        'Configurar TRUST_PROXY_HOPS (1 con nginx, 2 si además hay Cloudflare).',
    );
  }
}
bootstrap();
