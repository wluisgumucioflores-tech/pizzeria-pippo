package com.saas.aiorchestrator.agents.ingredients;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class IngredientsAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public IngredientsAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "ingredients";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Creating an ingredient is admin-only, same criteria as CategoriesAgent.
        // Not gated by allowedWriteDomains (no retrofit, see catalogo-tools.md).
        if ("admin".equals(role)) {
            return new Object[] {
                new IngredientsTools(client, businessId, role, toolPaths.ingredients()),
                new IngredientsWriteTools(client, businessId, role, toolPaths.ingredients()),
            };
        }
        return new Object[] { new IngredientsTools(client, businessId, role, toolPaths.ingredients()) };
    }
}
