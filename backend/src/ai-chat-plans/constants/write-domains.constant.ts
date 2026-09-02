// Domains the chat-ia orchestrator (services/ai-orchestrator) can write to when
// this plan enables them (ai_chat_plans.limits.allowed_write_domains). Only
// covers domains gated by plan config on top of role=admin — branches isn't
// here (the admin panel itself has no plan limit on branch count, so the chat
// tool doesn't get one either); categories/products/promotions are also
// admin-role-only, not retrofitted to this list (see
// docs/features/chat-ia-backend/catalogo-tools.md).
export const AI_CHAT_WRITE_DOMAINS = ['stock'] as const;

export type AiChatWriteDomain = (typeof AI_CHAT_WRITE_DOMAINS)[number];
