import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type {
  ContentBlock,
  MessageParam,
  TextBlockParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlockParam,
} from '@anthropic-ai/sdk/resources/messages';
import type {
  AiChatMessage,
  AiCompletionResult,
  AiProviderClient,
  AiTool,
  AiToolCall,
} from './ai-provider-client.interface';
import type { AiCompletionConfig } from './ai-completion-config.types';

@Injectable()
export class AnthropicProviderClient implements AiProviderClient {
  private readonly logger = new Logger(AnthropicProviderClient.name);

  async complete(
    config: AiCompletionConfig,
    system: string,
    messages: AiChatMessage[],
    tools?: AiTool[],
  ): Promise<AiCompletionResult> {
    const client = new Anthropic({ apiKey: config.apiKey });
    const start = Date.now();
    const response = await client.messages.create({
      model: config.model,
      max_tokens: 1024,
      system,
      messages: messages.map(toAnthropicMessage),
      ...(tools?.length ? { tools: tools.map(toAnthropicTool) } : {}),
    });
    this.logger.log(
      `${config.model} completion took ${Date.now() - start}ms (${messages.length} messages, ${tools?.length ?? 0} tools)`,
    );

    if (response.stop_reason === 'tool_use') {
      const calls: AiToolCall[] = response.content
        .filter(
          (block): block is ContentBlock & { type: 'tool_use' } =>
            block.type === 'tool_use',
        )
        .map((block) => ({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        }));
      return { type: 'tool_calls', calls };
    }

    const text = response.content.find(
      (block): block is ContentBlock & { type: 'text' } =>
        block.type === 'text',
    );
    return { type: 'text', content: text?.text.trim() ?? '' };
  }
}

function toAnthropicTool(tool: AiTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as unknown as Tool.InputSchema,
  };
}

function toAnthropicMessage(message: AiChatMessage): MessageParam {
  if (message.role === 'tool') {
    const block: ToolResultBlockParam = {
      type: 'tool_result',
      tool_use_id: message.toolCallId ?? '',
      content: message.content,
    };
    return { role: 'user', content: [block] };
  }

  if (message.role === 'assistant' && message.toolCalls?.length) {
    const blocks: (TextBlockParam | ToolUseBlockParam)[] = [
      ...(message.content
        ? [{ type: 'text' as const, text: message.content }]
        : []),
      ...message.toolCalls.map((call): ToolUseBlockParam => ({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: call.arguments,
      })),
    ];
    return { role: 'assistant', content: blocks };
  }

  return {
    role: message.role === 'assistant' ? 'assistant' : 'user',
    content: message.content,
  };
}
