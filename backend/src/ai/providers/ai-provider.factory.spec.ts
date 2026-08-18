import { AiProviderFactory } from './ai-provider.factory';
import { AnthropicProviderClient } from './anthropic-provider.client';
import { OpenAiCompatibleProviderClient } from './openai-compatible-provider.client';

describe('AiProviderFactory', () => {
  let anthropic: AnthropicProviderClient;
  let openaiCompatible: OpenAiCompatibleProviderClient;
  let factory: AiProviderFactory;

  beforeEach(() => {
    anthropic = new AnthropicProviderClient();
    openaiCompatible = new OpenAiCompatibleProviderClient();
    factory = new AiProviderFactory(anthropic, openaiCompatible);
  });

  it('resuelve AnthropicProviderClient para "anthropic"', () => {
    expect(factory.resolve('anthropic')).toBe(anthropic);
  });

  it('resuelve OpenAiCompatibleProviderClient para "openai_compatible"', () => {
    expect(factory.resolve('openai_compatible')).toBe(openaiCompatible);
  });
});
