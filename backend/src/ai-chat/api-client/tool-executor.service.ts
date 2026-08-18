import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SettingsService } from '../../settings/settings.service';
import {
  ToolRegistryService,
  type ResolvedOperation,
} from '../tool-registry/tool-registry.service';
import type { AiToolCall } from '../../ai/providers/ai-provider-client.interface';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';

// Intentionally short — the token only needs to live for a single internal
// HTTP call, not an entire conversation.
const AGENT_JWT_TTL_SECONDS = 120;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The max response body length we let a failing tool call surface back to
// the model — long enough for a NestJS error JSON, short enough to bound
// the prompt if something unexpected comes back.
const MAX_ERROR_BODY_LENGTH = 500;

const buildUrlLogger = new Logger('ToolExecutorService');

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly jwtService: JwtService,
  ) {}

  // Never calls another module's services directly — makes a real HTTP fetch
  // against the backend itself, signing its own short-lived JWT (the agent's
  // identity, not the admin's who opened the chat) to go through the same
  // JwtAuthGuard/RolesGuard as any other client.
  async execute(call: AiToolCall, user: CurrentUserPayload): Promise<string> {
    const operation = this.toolRegistry.getOperation(call.name);
    if (!operation)
      return `Error: la herramienta "${call.name}" no está disponible.`;

    const settings = await this.settingsService.getRawSettings(user, [
      'ai_chat_internal_api_key',
      'ai_chat_agent_profile_id',
    ]);
    const agentProfileId = settings['ai_chat_agent_profile_id'];
    if (!settings['ai_chat_internal_api_key'] || !agentProfileId) {
      return 'Error: el chat de IA no tiene una API key interna configurada (Settings → Chat IA).';
    }

    const token = this.jwtService.sign(
      { sub: agentProfileId },
      { secret: process.env.JWT_SECRET, expiresIn: AGENT_JWT_TTL_SECONDS },
    );

    const url = buildUrl(operation, call.arguments);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.text();
      if (!response.ok) {
        this.logger.warn(
          `Tool ${call.name} respondió ${response.status}: ${body}`,
        );
        const detail = body.slice(0, MAX_ERROR_BODY_LENGTH);
        return `Error ${response.status} al ejecutar ${call.name}: ${detail}`;
      }
      return body;
    } catch (err) {
      this.logger.error(`Tool ${call.name} falló`, err);
      return `Error al ejecutar ${call.name}.`;
    }
  }
}

function buildUrl(
  operation: ResolvedOperation,
  args: Record<string, unknown>,
): string {
  let path = operation.path;
  const query = new URLSearchParams();

  for (const param of operation.parameters) {
    const value = args[param.name];
    if (value === undefined || value === null || value === '') continue;
    const stringValue = toStringValue(value);

    // The model sometimes hallucinates a value for optional ID/UUID params
    // instead of omitting them (despite the system prompt telling it not
    // to) — smaller local models follow that instruction less reliably.
    // Drop it here instead of forwarding a value that will just 400.
    const format =
      param.schema && 'format' in param.schema
        ? param.schema.format
        : undefined;
    if (format === 'uuid' && !UUID_PATTERN.test(stringValue)) {
      buildUrlLogger.warn(
        `Dropping invalid ${param.name}="${stringValue}" (not a UUID) from ${operation.method.toUpperCase()} ${operation.path}`,
      );
      continue;
    }

    if (param.in === 'path') {
      path = path.replace(`{${param.name}}`, encodeURIComponent(stringValue));
    } else {
      query.set(param.name, stringValue);
    }
  }

  const port = process.env.PORT ?? 3333;
  const qs = query.toString();
  return `http://localhost:${port}${path}${qs ? `?${qs}` : ''}`;
}

// The arguments the model sends should always be primitives (that's how
// buildInputSchema types them in tool-registry.service.ts), but just in case,
// this avoids String()'s "[object Object]" if an object ever comes through.
function toStringValue(value: unknown): string {
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}
