package com.saas.aiorchestrator.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;

// Resolves the current system prompt (ai_prompts table) from NestJS, cached briefly
// (backend.cache-ttl) — a superadmin edit can take up to that long to reach a live chat.
@Component
public class SystemPromptClient {

    private final RestClient restClient;
    private final String internalToken;
    private final TtlCache<String, String> cache;

    public SystemPromptClient(
            RestClient.Builder builder,
            @Value("${backend.url}") String backendUrl,
            @Value("${backend.internal-token}") String internalToken,
            @Value("${backend.cache-ttl:30s}") Duration cacheTtl) {
        this.restClient = builder.baseUrl(backendUrl).build();
        this.internalToken = internalToken;
        this.cache = new TtlCache<>(cacheTtl);
    }

    public String fetch(String locale) {
        return cache.get(locale, this::fetchFromBackend);
    }

    private String fetchFromBackend(String locale) {
        SystemPromptResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder.path("/ai-chat/system-prompt").queryParam("locale", locale).build())
                .header("X-Internal-Token", internalToken)
                .retrieve()
                .body(SystemPromptResponse.class);
        return response.content();
    }

    private record SystemPromptResponse(String locale, String content) {}
}
