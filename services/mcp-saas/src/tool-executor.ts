import type { ResolvedOperation } from './tool-registry';
import type { PippoClient } from './pippo-client';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The max response body length surfaced back to the MCP client on a
// failing call — long enough for a NestJS error JSON, short enough to
// bound the response if something unexpected comes back.
const MAX_ERROR_BODY_LENGTH = 500;

// Ported from backend/src/ai-chat/api-client/tool-executor.service.ts
// (prototype on feature/chat-ia-agente-admin), adapted to call a remote
// backend URL and to retry once with a fresh token on 401 (the cached
// token here can genuinely be stale in a way the same-process reference
// never had to handle).
export async function executeTool(
  pippoClient: PippoClient,
  operation: ResolvedOperation,
  args: Record<string, unknown>,
): Promise<string> {
  const url = buildUrl(pippoClient.baseUrl, operation, args);

  const call = async (token: string) => {
    try {
      return await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
    } catch {
      return null;
    }
  };

  let token = await pippoClient.getBearerToken();
  let response = await call(token);
  if (!response) return `Error: no se pudo conectar al backend (${url}).`;

  if (response.status === 401) {
    token = await pippoClient.refreshToken();
    response = await call(token);
    if (!response) return `Error: no se pudo conectar al backend (${url}).`;
  }

  const body = await response.text();
  if (!response.ok) {
    return `Error ${response.status}: ${body.slice(0, MAX_ERROR_BODY_LENGTH)}`;
  }
  return body;
}

function buildUrl(baseUrl: string, operation: ResolvedOperation, args: Record<string, unknown>): string {
  let path = operation.path;
  const query = new URLSearchParams();

  for (const param of operation.parameters) {
    const value = args[param.name];
    if (value === undefined || value === null || value === '') continue;
    const stringValue = toStringValue(value);

    // The model sometimes hallucinates a value for an optional ID/UUID
    // param instead of omitting it — drop it here instead of forwarding a
    // value that will just 400 against the real backend.
    if (param.schema?.format === 'uuid' && !UUID_PATTERN.test(stringValue)) {
      continue;
    }

    if (param.in === 'path') {
      path = path.replace(`{${param.name}}`, encodeURIComponent(stringValue));
    } else {
      query.set(param.name, stringValue);
    }
  }

  const qs = query.toString();
  return `${baseUrl}${path}${qs ? `?${qs}` : ''}`;
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}
