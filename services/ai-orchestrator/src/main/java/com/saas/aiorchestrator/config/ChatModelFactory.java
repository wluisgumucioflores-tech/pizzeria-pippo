package com.saas.aiorchestrator.config;

import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.anthropic.AnthropicChatOptions;
import org.springframework.ai.anthropic.api.AnthropicApi;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.ai.ollama.api.OllamaOptions;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.stereotype.Component;

import java.net.URI;

// "provider" is a PROTOCOL, not a brand (see packages/shared/src/constants/ai-model-providers.ts) —
// "openai_compatible" covers Qwen/DashScope, DeepSeek, Groq, etc. via their own base_url.
@Component
public class ChatModelFactory {

    private static final String DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
    private static final String DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";

    public ChatModel build(RuntimeConfig cfg) {
        return switch (cfg.provider()) {
            case "ollama" -> buildOllama(cfg);
            case "anthropic" -> buildAnthropic(cfg);
            case "openai_compatible", "openai" -> buildOpenAi(cfg);
            // Fail loudly instead of silently falling back to Ollama on a typo'd provider.
            default -> throw new IllegalArgumentException("Unknown ai_models.provider: " + cfg.provider());
        };
    }

    private ChatModel buildOllama(RuntimeConfig cfg) {
        String baseUrl = cfg.baseURL() != null ? cfg.baseURL() : DEFAULT_OLLAMA_BASE_URL;
        return OllamaChatModel.builder()
                .ollamaApi(OllamaApi.builder().baseUrl(baseUrl).build())
                .defaultOptions(OllamaOptions.builder().model(cfg.model()).build())
                .build();
    }

    private ChatModel buildAnthropic(RuntimeConfig cfg) {
        AnthropicApi.Builder apiBuilder = AnthropicApi.builder().apiKey(cfg.apiKey());
        if (cfg.baseURL() != null) {
            apiBuilder.baseUrl(cfg.baseURL());
        }
        return AnthropicChatModel.builder()
                .anthropicApi(apiBuilder.build())
                .defaultOptions(AnthropicChatOptions.builder().model(cfg.model()).build())
                .build();
    }

    private ChatModel buildOpenAi(RuntimeConfig cfg) {
        // Trimmed defensively — a stray trailing space defeats endsWith() below and gets URL-encoded.
        String configured = cfg.baseURL() != null ? cfg.baseURL().trim() : DEFAULT_OPENAI_BASE_URL;
        OpenAiApi.Builder apiBuilder = OpenAiApi.builder().apiKey(cfg.apiKey());

        // OpenAiApi appends its own fixed "/v1/chat/completions" — a base_url that already
        // ends in that path (copied from a provider's docs) would double it, so split it here.
        if (configured.endsWith("/chat/completions")) {
            URI uri = URI.create(configured);
            apiBuilder.baseUrl(uri.getScheme() + "://" + uri.getAuthority()).completionsPath(uri.getPath());
        } else {
            apiBuilder.baseUrl(configured);
        }

        return OpenAiChatModel.builder()
                .openAiApi(apiBuilder.build())
                .defaultOptions(OpenAiChatOptions.builder().model(cfg.model()).build())
                .build();
    }
}
