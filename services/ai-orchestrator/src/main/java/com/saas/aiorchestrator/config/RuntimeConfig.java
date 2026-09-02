package com.saas.aiorchestrator.config;

import java.util.List;

// From NestJS's GET /ai-chat/runtime-config. apiKey only travels over this internal channel — never logged.
// allowedWriteDomains comes from the business's ai_chat_plan (empty/absent = no write domain enabled).
public record RuntimeConfig(String provider, String model, String baseURL, String apiKey,
        List<String> allowedWriteDomains) {}
