package com.saas.aiorchestrator.chat.dto;

// branchId/branchName come pre-resolved from NestJS (AiChatProxyService) — the caller's
// only visible branch, or their explicit selection when they have more than one.
// null = no default, the model falls back to asking/using getBranches as before.
// businessName is the tenant's own name (businesses.name) — lets the agent introduce
// itself with the actual business it's serving instead of a hardcoded one.
public record ToolChatRequest(String message, String businessId, String locale, String conversationId, String role,
        String branchId, String branchName, String businessName) {}
