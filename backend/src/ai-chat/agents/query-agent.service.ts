import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { AiProviderFactory } from '../../ai/providers/ai-provider.factory';
import type { AiProviderName } from '../../ai/providers/ai-provider.factory';
import type { AiChatMessage } from '../../ai/providers/ai-provider-client.interface';
import type { AiCompletionConfig } from '../../ai/providers/ai-completion-config.types';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';
import { ToolRegistryService } from '../tool-registry/tool-registry.service';
import { ToolExecutorService } from '../api-client/tool-executor.service';
import { buildSystemPrompt, type ChatLocale } from './build-system-prompt';

const SETTINGS_KEYS = [
  'ai_chat_provider',
  'ai_chat_anthropic_api_key',
  'ai_chat_openai_compatible_api_key',
  'ai_chat_openai_compatible_base_url',
  'ai_chat_model',
  'ai_chat_internal_api_key',
];

// Bounded so the model can't enter an infinite tool-call loop.
const MAX_TOOL_ITERATIONS = 4;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// v1: the only agent available — handles read-only queries.
// When more specialized agents are added, this file stays as the structural
// reference (resolve config, build prompt, run the complete()<->tools loop)
// for the new ones.
@Injectable()
export class QueryAgentService {
  private readonly logger = new Logger(QueryAgentService.name);

  constructor(
    private readonly settingsService: SettingsService,
    private readonly aiProviderFactory: AiProviderFactory,
    private readonly toolRegistry: ToolRegistryService,
    private readonly toolExecutor: ToolExecutorService,
  ) {}

  async run(
    user: CurrentUserPayload,
    history: ChatTurn[],
    locale: ChatLocale = 'es',
  ): Promise<string> {
    const runStart = Date.now();
    const settings = await this.settingsService.getRawSettings(
      user,
      SETTINGS_KEYS,
    );
    const resolved = this.resolveProviderConfig(settings);
    if (!resolved) {
      throw new BadRequestException(
        'Configurá el proveedor de IA en Settings → Chat IA antes de usar el chat.',
      );
    }

    // Without an internal API key configured, the agent still chats but has
    // no access to real data — no tools are offered to it.
    const tools = settings['ai_chat_internal_api_key']
      ? this.toolRegistry.getTools()
      : undefined;
    const client = this.aiProviderFactory.resolve(resolved.provider);
    const system = buildSystemPrompt(locale);

    let messages: AiChatMessage[] = history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const iterationStart = Date.now();
      const result = await client.complete(
        resolved.config,
        system,
        messages,
        tools,
      );
      this.logger.log(
        `Iteration ${i} (${resolved.provider}/${resolved.config.model}) resolved in ${Date.now() - iterationStart}ms with type=${result.type}`,
      );
      if (result.type === 'text') {
        this.logger.log(`Total run() time: ${Date.now() - runStart}ms`);
        return result.content;
      }

      messages = [
        ...messages,
        { role: 'assistant', content: '', toolCalls: result.calls },
      ];
      for (const call of result.calls) {
        const toolStart = Date.now();
        const output = await this.toolExecutor.execute(call, user);
        this.logger.log(
          `Tool ${call.name} executed in ${Date.now() - toolStart}ms`,
        );
        messages = [
          ...messages,
          { role: 'tool', content: output, toolCallId: call.id },
        ];
      }
    }

    this.logger.log(
      `Total run() time (max iterations reached): ${Date.now() - runStart}ms`,
    );
    return 'No pude completar tu consulta, intentá reformularla en menos pasos.';
  }

  private resolveProviderConfig(
    settings: Record<string, string>,
  ): { provider: AiProviderName; config: AiCompletionConfig } | null {
    const provider = (settings['ai_chat_provider'] ||
      'anthropic') as AiProviderName;

    if (provider === 'anthropic') {
      const apiKey = settings['ai_chat_anthropic_api_key'];
      if (!apiKey) return null;
      return {
        provider,
        config: {
          apiKey,
          model: settings['ai_chat_model'] || 'claude-haiku-4-5-20251001',
        },
      };
    }

    const apiKey = settings['ai_chat_openai_compatible_api_key'];
    if (!apiKey) return null;
    return {
      provider,
      config: {
        apiKey,
        model: settings['ai_chat_model'] || 'qwen-plus',
        baseURL: settings['ai_chat_openai_compatible_base_url'] || undefined,
      },
    };
  }
}
