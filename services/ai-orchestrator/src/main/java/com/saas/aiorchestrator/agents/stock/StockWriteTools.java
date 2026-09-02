package com.saas.aiorchestrator.agents.stock;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.LinkedHashMap;
import java.util.Map;

// Only bound to the ChatClient for role="admin" and when the business's plan
// enables the "stock" write domain (see StockAgent).
public class StockWriteTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final ToolPaths toolPaths;

    public StockWriteTools(BackendAgentClient client, String businessId, String role, ToolPaths toolPaths) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.toolPaths = toolPaths;
    }

    @Tool(description = "Registers a stock purchase — adds quantity to the current ingredient stock at a branch. "
            + "Before calling it: resolve the branch with getBranches if the user names one, and resolve the "
            + "ingredient's UUID and unit with getStock (it lists each ingredient's id/name/unit per branch) so "
            + "you can tell the user the unit back (e.g. kg, litros, unidades) in your response.")
    public String purchaseStock(
            @ToolParam(description = "Branch UUID, resolved with getBranches") String branchId,
            @ToolParam(description = "Ingredient UUID, resolved with getStock") String ingredientId,
            @ToolParam(description = "Quantity purchased, in the ingredient's own unit") Double quantity,
            @ToolParam(description = "New minimum-stock threshold for alerts, if the user wants to change it",
                    required = false) Double minQuantity) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("branch_id", branchId);
        body.put("ingredient_id", ingredientId);
        body.put("quantity", quantity);
        if (minQuantity != null) {
            body.put("min_quantity", minQuantity);
        }
        return client.post(businessId, role, toolPaths.stockPurchase(), body);
    }

    @Tool(description = "Adjusts an ingredient's stock at a branch to a real counted quantity — overwrites the "
            + "current value, it does not add to it (use purchaseStock for a purchase instead). Use it for "
            + "corrections: physical counts, spoilage/loss, etc. Before calling it: resolve the branch with "
            + "getBranches if the user names one, and resolve the ingredient's UUID with getStock. Always confirm "
            + "with the user that they mean the final real quantity, not an amount to subtract.")
    public String adjustStock(
            @ToolParam(description = "Branch UUID, resolved with getBranches") String branchId,
            @ToolParam(description = "Ingredient UUID, resolved with getStock") String ingredientId,
            @ToolParam(description = "The real quantity counted, in the ingredient's own unit") Double realQuantity,
            @ToolParam(description = "Reason for the adjustment (e.g. 'merma', 'conteo físico')", required = false)
                    String notes) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("branch_id", branchId);
        body.put("ingredient_id", ingredientId);
        body.put("real_quantity", realQuantity);
        if (notes != null) {
            body.put("notes", notes);
        }
        return client.post(businessId, role, toolPaths.stockAdjust(), body);
    }
}
