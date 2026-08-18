import type { AiCompletionConfig } from './ai-completion-config.types';

export interface AiToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AiChatMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  // Only set on an 'assistant' message that requested tool calls.
  toolCalls?: AiToolCall[];
  // Only set on a 'tool' message — links the result back to AiToolCall.id.
  toolCallId?: string;
}

export interface AiTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type AiCompletionResult =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; calls: AiToolCall[] };

export interface AiProviderClient {
  complete(
    config: AiCompletionConfig,
    system: string,
    messages: AiChatMessage[],
    tools?: AiTool[],
  ): Promise<AiCompletionResult>;
}
