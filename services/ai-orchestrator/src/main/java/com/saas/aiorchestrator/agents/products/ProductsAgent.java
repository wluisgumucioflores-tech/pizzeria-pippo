package com.saas.aiorchestrator.agents.products;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class ProductsAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public ProductsAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "products";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Creating a product is admin-only, same criteria as CategoriesAgent.
        // Not gated by allowedWriteDomains (no retrofit, see catalogo-tools.md).
        if ("admin".equals(role)) {
            return new Object[] {
                new ProductsTools(client, businessId, role, toolPaths.products()),
                new ProductsWriteTools(client, businessId, role, toolPaths.products(), toolPaths.branches()),
            };
        }
        return new Object[] { new ProductsTools(client, businessId, role, toolPaths.products()) };
    }
}
