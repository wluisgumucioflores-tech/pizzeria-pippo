import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { webcrypto } from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { PippoClient } from './pippo-client';
import { ToolRegistry } from './tool-registry';
import { executeTool } from './tool-executor';

const PORT = Number(process.env.PORT ?? 8787);
const PIPPO_BACKEND_URL = process.env.PIPPO_BACKEND_URL ?? 'http://localhost:3333';

interface TenantSession {
  client: PippoClient;
  toolRegistry: ToolRegistry;
}

// Module-scope cache, keyed by a hash of the caller's API key — lives for
// the lifetime of this process, avoids re-exchanging the token and
// re-fetching the OpenAPI spec on every single tool call. v1 has exactly
// one tenant behind this, but the cache is already per-key so adding more
// tenants later is just "more entries", no structural change.
const tenantSessions = new Map<string, TenantSession>();

// Uncaught errors used to be invisible: nothing logged them, and an
// unhandled rejection would silently kill the whole process (leaving the
// tunnel's origin unreachable for every client, not just the one that
// triggered it) with zero trace of why. Log instead of crashing — a bad
// request from one client shouldn't take down the process for everyone
// else.
process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection:', reason);
});

const app = new Hono();

app.use('*', logger());

// Some MCP clients (browser-based or app connectors like ChatGPT) send a
// CORS preflight OPTIONS before the real POST — without this, that
// preflight fails before our Authorization check even runs, and it looks
// like the request "disappeared" (no application log, just a generic
// failure from the client). Matches the SDK's own reference Hono example.
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'mcp-session-id', 'mcp-protocol-version'],
    exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
  }),
);

app.get('/health', (c) => c.json({ status: 'ok' }));

// Stateless mode (no sessionIdGenerator) — every request gets its own
// Server/transport pair, backed by the same cached PippoClient/tool list.
// Fine for v1: tool calls are independent GET requests, there's no
// multi-turn session state worth persisting on the MCP protocol level
// itself. Runs on plain Node via @hono/node-server for now — a Cloudflare
// Workers deploy is a possible future step (WebStandardStreamableHTTPServerTransport
// and every other file in src/ are already runtime-agnostic Web Standard
// TS; only this file and the process entry point would need to change).
app.all('/mcp', async (c) => {
  const authHeader = c.req.header('Authorization');
  const apiKey = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!apiKey) {
    return c.text('Missing Authorization header', 401);
  }

  let session: TenantSession;
  try {
    session = await getOrCreateSession(apiKey);
  } catch (err) {
    return c.text(`mcp-saas: no se pudo autenticar contra el backend (${(err as Error).message})`, 502);
  }

  try {
    const server = new Server({ name: 'pippo-mcp-saas', version: '0.1.0' }, { capabilities: { tools: {} } });
    registerHandlers(server, session);

    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return await transport.handleRequest(c.req.raw);
  } catch (err) {
    console.error(`Error manejando ${c.req.method} /mcp:`, err);
    return c.text('Internal server error', 500);
  }
});

async function getOrCreateSession(apiKey: string): Promise<TenantSession> {
  const cacheKey = await hashApiKey(apiKey);
  const cached = tenantSessions.get(cacheKey);
  if (cached) return cached;

  const client = new PippoClient(PIPPO_BACKEND_URL, apiKey);
  const spec = await client.fetchOpenApiSpec();
  const toolRegistry = new ToolRegistry();
  toolRegistry.loadDocument(spec as Parameters<ToolRegistry['loadDocument']>[0]);

  const session: TenantSession = { client, toolRegistry };
  tenantSessions.set(cacheKey, session);
  return session;
}

function registerHandlers(server: Server, session: TenantSession): void {
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: session.toolRegistry.getTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const operation = session.toolRegistry.getOperation(request.params.name);
    if (!operation) {
      return { content: [{ type: 'text', text: `Error: la herramienta "${request.params.name}" no está disponible.` }] };
    }
    const result = await executeTool(session.client, operation, request.params.arguments ?? {});
    return { content: [{ type: 'text', text: result }] };
  });
}

async function hashApiKey(apiKey: string): Promise<string> {
  const bytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`mcp-saas escuchando en http://localhost:${info.port}`);
  console.log(`Backend Pippo: ${PIPPO_BACKEND_URL}`);
  console.log(`Endpoint MCP: http://localhost:${info.port}/mcp`);
});
