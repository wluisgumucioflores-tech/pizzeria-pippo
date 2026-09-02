package com.saas.aiorchestrator.chat.dto;

public record ToolChatResponse(String model, String baseUrl, String reply, int promptTokens, int completionTokens) {}
