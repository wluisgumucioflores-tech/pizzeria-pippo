package com.saas.aiorchestrator.chat.dto;

// branchId/branchName come pre-resolved from NestJS (AiChatProxyService) — the caller's
// only visible branch, or their explicit selection when they have more than one.
// null = no default, the model falls back to asking/using getBranches as before.
public record ToolChatRequest(String message, String businessId, String locale, String conversationId, String role,
        String branchId, String branchName) {}
