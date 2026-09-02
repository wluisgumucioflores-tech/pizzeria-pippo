package com.saas.aiorchestrator.config;

import org.junit.jupiter.api.Test;
import org.springframework.ai.anthropic.AnthropicChatModel;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.openai.OpenAiChatModel;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

// Pure unit tests, no Spring context: ChatModelFactory only dispatches to a
// builder based on RuntimeConfig.provider() — the thing worth locking down
// is that each provider string routes to the right ChatModel implementation.
class ChatModelFactoryTest {

    private final ChatModelFactory factory = new ChatModelFactory();

    @Test
    void routesOllamaProviderToOllamaChatModel() {
        ChatModel model = factory.build(new RuntimeConfig("ollama", "qwen3:8b", null, null, List.of()));

        assertThat(model).isInstanceOf(OllamaChatModel.class);
    }

    @Test
    void rejectsUnknownProvider() {
        // Regression test: an unrecognized provider string used to silently
        // fall back to local Ollama, turning a typo (e.g. "qwen" instead of
        // "openai_compatible") into a confusing 404 against the wrong
        // protocol. It must fail loudly instead.
        assertThatThrownBy(() -> factory.build(new RuntimeConfig("something-else", "qwen3:8b", null, null, List.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("something-else");
    }

    @Test
    void routesAnthropicProviderToAnthropicChatModel() {
        ChatModel model = factory.build(new RuntimeConfig("anthropic", "claude-3-5-sonnet", null, "test-key", List.of()));

        assertThat(model).isInstanceOf(AnthropicChatModel.class);
    }

    @Test
    void routesOpenAiCompatibleProviderToOpenAiChatModel() {
        ChatModel model = factory.build(
                new RuntimeConfig("openai_compatible", "deepseek-chat", "https://api.deepseek.com", "test-key",
                        List.of()));

        assertThat(model).isInstanceOf(OpenAiChatModel.class);
    }

    @Test
    void acceptsAFullLiteralCompletionsUrlAsBaseUrl() {
        // Regression test: pasting the exact URL a provider's docs/curl example
        // gives (ending in /chat/completions, e.g. DashScope's compatible-mode
        // endpoint) used to double up with OpenAiApi's own default completions
        // path and 404. Must build without throwing either way.
        ChatModel model = factory.build(new RuntimeConfig(
                "openai_compatible",
                "qwen3.8-flash",
                "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
                "test-key",
                List.of()));

        assertThat(model).isInstanceOf(OpenAiChatModel.class);
    }
}
