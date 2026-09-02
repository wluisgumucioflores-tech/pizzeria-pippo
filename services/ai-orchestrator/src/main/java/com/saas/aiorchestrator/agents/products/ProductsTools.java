package com.saas.aiorchestrator.agents.products;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

public class ProductsTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String productsPath;

    public ProductsTools(BackendAgentClient client, String businessId, String role, String productsPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.productsPath = productsPath;
    }

    @Tool(description = "Gets the business's product catalog, paginated. By default only returns active ones.")
    public String getProducts(
            @ToolParam(description = "Text to search by product name", required = false) String search,
            @ToolParam(description = "Category UUID, to filter by a single one", required = false)
                    String categoryId,
            @ToolParam(description = "If true, also includes inactive products", required = false)
                    Boolean showInactive,
            @ToolParam(description = "Page number (starts at 1)", required = false) Integer page,
            @ToolParam(description = "Number of results per page", required = false) Integer pageSize) {
        String path = UriComponentsBuilder.fromPath(productsPath)
                .queryParamIfPresent("search", Optional.ofNullable(search))
                .queryParamIfPresent("category_id", Optional.ofNullable(categoryId))
                .queryParamIfPresent("showInactive", Optional.ofNullable(showInactive).map(Object::toString))
                .queryParamIfPresent("page", Optional.ofNullable(page))
                .queryParamIfPresent("pageSize", Optional.ofNullable(pageSize))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }
}
