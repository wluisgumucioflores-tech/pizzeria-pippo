package com.saas.aiorchestrator.agents.promotions;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class PromotionsAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public PromotionsAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "promotions";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Creating a promotion is admin-only — not offered to the model otherwise.
        // Not gated by allowedWriteDomains (no retrofit, see catalogo-tools.md).
        if ("admin".equals(role)) {
            return new Object[] {
                new PromotionsTools(client, businessId, role, toolPaths.promotions()),
                new PromotionsWriteTools(client, businessId, role, toolPaths.promotions()),
            };
        }
        return new Object[] { new PromotionsTools(client, businessId, role, toolPaths.promotions()) };
    }
}
