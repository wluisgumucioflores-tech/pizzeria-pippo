package com.saas.aiorchestrator.agents.varianttypes;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class VariantTypesAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public VariantTypesAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "variantTypes";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Creating a variant type is admin-only, same criteria as CategoriesAgent.
        // Not gated by allowedWriteDomains (no retrofit, see catalogo-tools.md).
        if ("admin".equals(role)) {
            return new Object[] {
                new VariantTypesTools(client, businessId, role, toolPaths.variantTypes()),
                new VariantTypesWriteTools(client, businessId, role, toolPaths.variantTypes()),
            };
        }
        return new Object[] { new VariantTypesTools(client, businessId, role, toolPaths.variantTypes()) };
    }
}
