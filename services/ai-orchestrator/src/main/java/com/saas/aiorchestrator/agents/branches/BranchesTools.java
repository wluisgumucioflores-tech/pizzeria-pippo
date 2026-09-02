package com.saas.aiorchestrator.agents.branches;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

public class BranchesTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String branchesPath;

    public BranchesTools(BackendAgentClient client, String businessId, String role, String branchesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.branchesPath = branchesPath;
    }

    @Tool(description = "Gets the business's list of branches, with their id and name. Use this tool first to "
            + "resolve a branch's UUID when the user mentions it by name, before calling other tools that "
            + "accept branchId.")
    public String getBranches(
            @ToolParam(description = "If true, also includes inactive branches", required = false)
                    Boolean showInactive) {
        String path = UriComponentsBuilder.fromPath(branchesPath)
                .queryParamIfPresent("showInactive", Optional.ofNullable(showInactive).map(Object::toString))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }
}
