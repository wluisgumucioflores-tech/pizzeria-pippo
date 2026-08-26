import { ALLOWED_OPERATIONS } from './allowed-operations';

// Minimal shape of the OpenAPI 3 document we care about — the full spec has
// far more fields, this only types what buildInputSchema/loadDocument read.
interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  description?: string;
  schema?: { type?: string; format?: string };
}

interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: OpenApiParameter[];
}

interface OpenApiDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
}

export interface ResolvedOperation {
  path: string;
  method: string;
  parameters: OpenApiParameter[];
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const ALLOWED_HTTP_METHOD = 'get';

// Ported from backend/src/ai-chat/tool-registry/tool-registry.service.ts
// (prototype on feature/chat-ia-agente-admin) — same shape, adapted to read
// the OpenAPI JSON fetched over HTTP from GET /mcp/openapi.json instead of
// an in-process SwaggerModule document.
export class ToolRegistry {
  private readonly operations = new Map<string, ResolvedOperation & { summary: string }>();

  loadDocument(document: OpenApiDocument): void {
    this.operations.clear();

    for (const [path, item] of Object.entries(document.paths)) {
      const operation = item[ALLOWED_HTTP_METHOD];
      if (!operation?.operationId || !ALLOWED_OPERATIONS.includes(operation.operationId)) continue;

      this.operations.set(operation.operationId, {
        path,
        method: ALLOWED_HTTP_METHOD,
        parameters: operation.parameters ?? [],
        summary: operation.summary || operation.description || operation.operationId,
      });
    }
  }

  getTools(): McpTool[] {
    return Array.from(this.operations.entries()).map(([operationId, op]) => ({
      name: operationId,
      description: op.summary,
      inputSchema: buildInputSchema(op.parameters),
    }));
  }

  getOperation(operationId: string): ResolvedOperation | undefined {
    return this.operations.get(operationId);
  }
}

function buildInputSchema(parameters: OpenApiParameter[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of parameters) {
    properties[param.name] = {
      type: param.schema?.type ?? 'string',
      ...(param.schema?.format ? { format: param.schema.format } : {}),
      description: param.description,
    };
    if (param.required) required.push(param.name);
  }

  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {}),
  };
}
