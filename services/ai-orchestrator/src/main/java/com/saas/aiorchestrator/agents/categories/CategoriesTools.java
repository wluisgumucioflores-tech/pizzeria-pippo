package com.saas.aiorchestrator.agents.categories;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;

public class CategoriesTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String categoriesPath;

    public CategoriesTools(BackendAgentClient client, String businessId, String role, String categoriesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.categoriesPath = categoriesPath;
    }

    @Tool(description = "Gets the business's list of product categories.")
    public String getCategories() {
        return client.get(businessId, role, categoriesPath);
    }
}
