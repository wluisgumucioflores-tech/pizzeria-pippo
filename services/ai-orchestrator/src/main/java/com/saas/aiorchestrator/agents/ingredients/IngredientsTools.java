package com.saas.aiorchestrator.agents.ingredients;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

public class IngredientsTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String ingredientsPath;

    public IngredientsTools(BackendAgentClient client, String businessId, String role, String ingredientsPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.ingredientsPath = ingredientsPath;
    }

    @Tool(description = "Gets the business's ingredient catalog, paginated. Use this (not getStock) to check "
            + "whether an ingredient already exists before creating a new one — getStock only lists ingredients "
            + "that already have stock in some branch.")
    public String getIngredients(
            @ToolParam(description = "Search by name", required = false) String search,
            @ToolParam(description = "If true, also includes inactive ingredients", required = false)
                    Boolean showInactive,
            @ToolParam(description = "Page number (starts at 1)", required = false) Integer page,
            @ToolParam(description = "Number of results per page", required = false) Integer pageSize) {
        String path = UriComponentsBuilder.fromPath(ingredientsPath)
                .queryParamIfPresent("search", Optional.ofNullable(search))
                .queryParamIfPresent("showInactive", Optional.ofNullable(showInactive).map(Object::toString))
                .queryParamIfPresent("page", Optional.ofNullable(page))
                .queryParamIfPresent("pageSize", Optional.ofNullable(pageSize))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }
}
