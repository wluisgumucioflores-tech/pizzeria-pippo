package com.saas.aiorchestrator.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Duration;

// Resolves which model to use from NestJS, cached briefly (backend.cache-ttl) to
// avoid a round trip on every chat turn for something that rarely changes.
@Component
public class RuntimeConfigClient {

    private static final String GLOBAL_KEY = "__global__";

    private final RestClient restClient;
    private final String internalToken;
    private final TtlCache<String, RuntimeConfig> cache;

    public RuntimeConfigClient(
            RestClient.Builder builder,
            @Value("${backend.url}") String backendUrl,
            @Value("${backend.internal-token}") String internalToken,
            @Value("${backend.cache-ttl:30s}") Duration cacheTtl) {
        this.restClient = builder.baseUrl(backendUrl).build();
        this.internalToken = internalToken;
        this.cache = new TtlCache<>(cacheTtl);
    }

    // Without businessId (smoke-test /chat endpoint), falls back to the global default model.
    public RuntimeConfig fetch(String businessId) {
        String cacheKey = businessId != null ? businessId : GLOBAL_KEY;
        return cache.get(cacheKey, key -> fetchFromBackend(businessId));
    }

    private RuntimeConfig fetchFromBackend(String businessId) {
        return restClient.get()
                .uri(uriBuilder -> {
                    var builder = uriBuilder.path("/ai-chat/runtime-config");
                    if (businessId != null) {
                        builder = builder.queryParam("businessId", businessId);
                    }
                    return builder.build();
                })
                .header("X-Internal-Token", internalToken)
                .retrieve()
                .body(RuntimeConfig.class);
    }
}
