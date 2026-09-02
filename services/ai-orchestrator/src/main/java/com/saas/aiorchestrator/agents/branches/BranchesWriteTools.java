package com.saas.aiorchestrator.agents.branches;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.LinkedHashMap;
import java.util.Map;

// Only bound to the ChatClient for role="admin" and when the business's plan
// enables the "branches" write domain (see BranchesAgent).
public class BranchesWriteTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String branchesPath;

    public BranchesWriteTools(BackendAgentClient client, String businessId, String role, String branchesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.branchesPath = branchesPath;
    }

    @Tool(description = "Creates a new branch for the business.")
    public String createBranch(
            @ToolParam(description = "Branch name") String name,
            @ToolParam(description = "Address", required = false) String address,
            @ToolParam(description = "Phone number", required = false) String phone,
            @ToolParam(description = "Expected opening time, format HH:mm (informational, doesn't block sales)",
                    required = false) String expectedStartTime) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        if (address != null) {
            body.put("address", address);
        }
        if (phone != null) {
            body.put("phone", phone);
        }
        if (expectedStartTime != null) {
            body.put("expected_start_time", expectedStartTime);
        }
        return client.post(businessId, role, branchesPath, body);
    }
}
