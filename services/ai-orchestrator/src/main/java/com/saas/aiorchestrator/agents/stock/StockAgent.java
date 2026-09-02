package com.saas.aiorchestrator.agents.stock;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class StockAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public StockAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "stock";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Purchasing/adjusting stock needs both: admin role AND the business's
        // plan enabling it (ai_chat_plans.limits.allowed_write_domains).
        if ("admin".equals(role) && allowedWriteDomains.contains("stock")) {
            return new Object[] {
                new StockTools(client, businessId, role, toolPaths),
                new StockWriteTools(client, businessId, role, toolPaths),
            };
        }
        return new Object[] { new StockTools(client, businessId, role, toolPaths) };
    }
}
