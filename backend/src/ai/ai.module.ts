import { Module } from '@nestjs/common';
import { AnthropicProviderClient } from './providers/anthropic-provider.client';
import { OpenAiCompatibleProviderClient } from './providers/openai-compatible-provider.client';
import { AiProviderFactory } from './providers/ai-provider.factory';

@Module({
  providers: [
    AnthropicProviderClient,
    OpenAiCompatibleProviderClient,
    AiProviderFactory,
  ],
  exports: [AiProviderFactory],
})
export class AiModule {}
