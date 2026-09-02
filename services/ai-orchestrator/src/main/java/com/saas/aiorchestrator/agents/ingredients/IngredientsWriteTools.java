package com.saas.aiorchestrator.agents.ingredients;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.lang.Nullable;

import java.util.LinkedHashMap;
import java.util.Map;

// Only bound to the ChatClient for role="admin" (see IngredientsAgent). Not gated by
// allowed_write_domains — creating an ingredient is master data, same criteria as
// categories/branches (the panel doesn't limit it by plan either).
public class IngredientsWriteTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String ingredientsPath;

    public IngredientsWriteTools(BackendAgentClient client, String businessId, String role, String ingredientsPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.ingredientsPath = ingredientsPath;
    }

    @Tool(description = "Creates a new ingredient. Before calling it, check with getIngredients that one with "
            + "the same name doesn't already exist.")
    public String createIngredient(
            @ToolParam(description = "Ingredient name") String name,
            @ToolParam(description = "One of: g, kg, ml, l, unidad") String unit,
            @Nullable
            @ToolParam(description = "Whether it's shared across products (e.g. a topping used by several "
                    + "recipes) — ask the user only if it's genuinely unclear, defaults to false", required = false)
                    Boolean isSharedUse) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("unit", unit);
        if (isSharedUse != null) {
            body.put("is_shared_use", isSharedUse);
        }
        return client.post(businessId, role, ingredientsPath, body);
    }
}
