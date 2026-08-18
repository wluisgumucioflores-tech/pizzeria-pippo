import { Injectable } from '@nestjs/common';
import { AnthropicProviderClient } from './anthropic-provider.client';
import { OpenAiCompatibleProviderClient } from './openai-compatible-provider.client';
import type { AiProviderClient } from './ai-provider-client.interface';

export type AiProviderName = 'anthropic' | 'openai_compatible';

@Injectable()
export class AiProviderFactory {
  constructor(
    private readonly anthropic: AnthropicProviderClient,
    private readonly openaiCompatible: OpenAiCompatibleProviderClient,
  ) {}

  resolve(providerName: AiProviderName): AiProviderClient {
    return providerName === 'anthropic'
      ? this.anthropic
      : this.openaiCompatible;
  }
}
