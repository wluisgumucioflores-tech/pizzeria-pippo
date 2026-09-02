package com.saas.aiorchestrator.agents.promotions;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

public class PromotionsTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String promotionsPath;

    public PromotionsTools(BackendAgentClient client, String businessId, String role, String promotionsPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.promotionsPath = promotionsPath;
    }

    @Tool(description = "Gets the business's promotions. By default only returns the active ones.")
    public String getPromotions(
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId,
            @ToolParam(description = "If true, also includes inactive promotions", required = false)
                    Boolean showInactive,
            @ToolParam(description = "Reference date to filter validity, format YYYY-MM-DD",
                    required = false) String date) {
        String path = UriComponentsBuilder.fromPath(promotionsPath)
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .queryParamIfPresent("showInactive", Optional.ofNullable(showInactive).map(Object::toString))
                .queryParamIfPresent("date", Optional.ofNullable(date))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }
}
