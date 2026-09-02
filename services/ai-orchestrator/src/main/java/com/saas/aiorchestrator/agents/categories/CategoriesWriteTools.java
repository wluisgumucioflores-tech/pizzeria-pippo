package com.saas.aiorchestrator.agents.categories;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.LinkedHashMap;
import java.util.Map;

// Only bound to the ChatClient for role="admin" (see CategoriesAgent) — NestJS's
// @Roles('admin') guard on POST /categories is a real second barrier, not just this.
public class CategoriesWriteTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String categoriesPath;

    public CategoriesWriteTools(BackendAgentClient client, String businessId, String role, String categoriesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.categoriesPath = categoriesPath;
    }

    @Tool(description = "Creates a new product category for the business.")
    public String createCategory(
            @ToolParam(description = "Category name") String name,
            @ToolParam(
                    description = "Whether it's a pizza category (enables half-and-half, sizes, etc.)",
                    required = false) Boolean isPizza) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        if (isPizza != null) {
            body.put("is_pizza", isPizza);
        }
        return client.post(businessId, role, categoriesPath, body);
    }
}
