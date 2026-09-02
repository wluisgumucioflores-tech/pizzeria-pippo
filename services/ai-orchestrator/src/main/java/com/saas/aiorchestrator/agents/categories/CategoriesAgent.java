package com.saas.aiorchestrator.agents.categories;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class CategoriesAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public CategoriesAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "categories";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Creating a category is admin-only — not offered to the model otherwise.
        // Not gated by allowedWriteDomains (no retrofit, see catalogo-tools.md).
        if ("admin".equals(role)) {
            return new Object[] {
                new CategoriesTools(client, businessId, role, toolPaths.categories()),
                new CategoriesWriteTools(client, businessId, role, toolPaths.categories()),
            };
        }
        return new Object[] { new CategoriesTools(client, businessId, role, toolPaths.categories()) };
    }
}
