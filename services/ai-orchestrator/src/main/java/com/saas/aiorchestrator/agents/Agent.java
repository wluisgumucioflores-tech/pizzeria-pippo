package com.saas.aiorchestrator.agents;

import java.util.Set;

// A bundle of @Tool capabilities for a business domain, built per-request and
// bound to businessId/role — role lets write-capable agents decide whether to
// expose their write tools at all (e.g. only to "admin"). allowedWriteDomains
// comes from the business's ai_chat_plan (limits.allowed_write_domains) — a
// second, plan-level gate on top of role, currently only checked by
// branches/stock (see catalogo-tools.md for which domains use it).
public interface Agent {

    String name();

    Object[] tools(String businessId, String role, Set<String> allowedWriteDomains);
}
