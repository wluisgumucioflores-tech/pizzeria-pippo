package com.saas.aiorchestrator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

// Defaults for a /chat/tools request that omits something (manual/smoke-test calls only)
// plus the deployment's timezone — actual values in application.yml's chat.*.
@ConfigurationProperties(prefix = "chat")
public record ChatDefaults(String defaultLocale, String defaultRole, String timezoneOffset) {}
