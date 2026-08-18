import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import type {
  AiChatMessage,
  AiCompletionResult,
  AiProviderClient,
  AiTool,
  AiToolCall,
} from './ai-provider-client.interface';
import type { AiCompletionConfig } from './ai-completion-config.types';

@Injectable()
export class OpenAiCompatibleProviderClient implements AiProviderClient {
  private readonly logger = new Logger(OpenAiCompatibleProviderClient.name);

  async complete(
    config: AiCompletionConfig,
    system: string,
    messages: AiChatMessage[],
    tools?: AiTool[],
  ): Promise<AiCompletionResult> {
    const client = new OpenAI({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {}),
    });
    const start = Date.now();
    const response = await client.chat.completions.create({
      model: config.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: system },
        ...messages.map(toOpenAiMessage),
      ],
      ...(tools?.length ? { tools: tools.map(toOpenAiTool) } : {}),
    });
    this.logger.log(
      `${config.model} completion took ${Date.now() - start}ms (${messages.length} messages, ${tools?.length ?? 0} tools)`,
    );

    const message = response.choices[0]?.message;
    if (message?.tool_calls?.length) {
      const calls: AiToolCall[] = message.tool_calls
        .filter((call) => call.type === 'function')
        .map((call) => ({
          id: call.id,
          name: call.function.name,
          arguments: parseArguments(call.function.arguments),
        }));
      return { type: 'tool_calls', calls };
    }

    return { type: 'text', content: message?.content?.trim() ?? '' };
  }
}

function toOpenAiTool(tool: AiTool): ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

function toOpenAiMessage(message: AiChatMessage): ChatCompletionMessageParam {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.toolCallId ?? '',
      content: message.content,
    };
  }

  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    };
  }

  return { role: message.role, content: message.content };
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
