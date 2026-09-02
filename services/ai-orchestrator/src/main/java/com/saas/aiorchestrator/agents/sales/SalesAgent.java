package com.saas.aiorchestrator.agents.sales;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SalesAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public SalesAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "sales";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        return new Object[] { new SalesTools(client, businessId, role, toolPaths) };
    }
}
