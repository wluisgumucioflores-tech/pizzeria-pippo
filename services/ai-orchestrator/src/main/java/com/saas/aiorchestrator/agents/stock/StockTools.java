package com.saas.aiorchestrator.agents.stock;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

public class StockTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final ToolPaths toolPaths;

    public StockTools(BackendAgentClient client, String businessId, String role, ToolPaths toolPaths) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.toolPaths = toolPaths;
    }

    @Tool(description = "Gets the business's current ingredient stock, paginated.")
    public String getStock(
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId,
            @ToolParam(description = "Page number (starts at 1)", required = false) Integer page,
            @ToolParam(description = "Number of results per page", required = false) Integer pageSize) {
        String path = UriComponentsBuilder.fromPath(toolPaths.stock())
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .queryParamIfPresent("page", Optional.ofNullable(page))
                .queryParamIfPresent("pageSize", Optional.ofNullable(pageSize))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }

    @Tool(description = "Gets the business's low-stock or out-of-stock alerts.")
    public String getStockAlerts(
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId) {
        String path = UriComponentsBuilder.fromPath(toolPaths.stockAlerts())
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }

    @Tool(description = "Gets the stock movement history (purchases, sales, adjustments, reversals), paginated.")
    public String getStockMovements(
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId,
            @ToolParam(description = "Ingredient UUID, to filter by a single one", required = false)
                    String ingredientId,
            @ToolParam(description = "Movement type: compra, venta, ajuste or anulacion", required = false)
                    String type,
            @ToolParam(description = "Page number (starts at 1)", required = false) Integer page,
            @ToolParam(description = "Number of results per page", required = false) Integer pageSize) {
        String path = UriComponentsBuilder.fromPath(toolPaths.stockMovements())
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .queryParamIfPresent("ingredientId", Optional.ofNullable(ingredientId))
                .queryParamIfPresent("type", Optional.ofNullable(type))
                .queryParamIfPresent("page", Optional.ofNullable(page))
                .queryParamIfPresent("pageSize", Optional.ofNullable(pageSize))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }
}
