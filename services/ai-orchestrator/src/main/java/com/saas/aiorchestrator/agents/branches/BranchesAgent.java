package com.saas.aiorchestrator.agents.branches;

import com.saas.aiorchestrator.agents.Agent;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class BranchesAgent implements Agent {

    private final BackendAgentClient client;
    private final ToolPaths toolPaths;

    public BranchesAgent(BackendAgentClient client, ToolPaths toolPaths) {
        this.client = client;
        this.toolPaths = toolPaths;
    }

    @Override
    public String name() {
        return "branches";
    }

    @Override
    public Object[] tools(String businessId, String role, Set<String> allowedWriteDomains) {
        // Creating a branch is admin-only, same criteria as CategoriesAgent —
        // the UI itself has no plan limit on branch count, so the chat tool
        // doesn't get one either. Not gated by allowedWriteDomains.
        if ("admin".equals(role)) {
            return new Object[] {
                new BranchesTools(client, businessId, role, toolPaths.branches()),
                new BranchesWriteTools(client, businessId, role, toolPaths.branches()),
            };
        }
        return new Object[] { new BranchesTools(client, businessId, role, toolPaths.branches()) };
    }
}
