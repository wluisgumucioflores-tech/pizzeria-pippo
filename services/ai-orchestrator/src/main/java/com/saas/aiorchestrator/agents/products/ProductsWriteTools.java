package com.saas.aiorchestrator.agents.products;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.tools.ToolResult;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.lang.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Only bound to the ChatClient for role="admin" (see ProductsAgent). Mirrors the admin
// panel's fillMissingBranchPrices() so every branch gets a price, not just the ones the model mentioned.
public class ProductsWriteTools {

    private static final String RECIPE_REMINDER =
            "Nota: este producto es de tipo 'hecho en casa' (made) y todavía no tiene receta — "
                    + "hay que agregarle los ingredientes desde el panel de administración antes de venderlo, "
                    + "si no el descuento de stock no va a funcionar.";

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String productsPath;
    private final String branchesPath;
    private final ObjectMapper objectMapper;

    public ProductsWriteTools(
            BackendAgentClient client, String businessId, String role, String productsPath, String branchesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.productsPath = productsPath;
        this.branchesPath = branchesPath;
        this.objectMapper = new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Tool(description = "Creates a new product with its variants and prices. Before calling it: 1) resolve the "
            + "category with getCategories, 2) if it's not clear whether the product is prepared in the kitchen "
            + "or bought ready-made, ask the user, 3) call getBranches — if the business has more than one "
            + "branch, ask whether the price is the same for all of them or different per branch before building "
            + "the parameters. Image is not supported yet, don't ask about it.")
    public String createProduct(
            @ToolParam(description = "Product name") String name,
            @ToolParam(description = "Category UUID, resolved beforehand with getCategories") String categoryId,
            @ToolParam(description = "'made' if it's prepared in the kitchen with a recipe, 'resale' if it's "
                    + "bought ready-made") String productType,
            @ToolParam(description = "Description shown to the customer", required = false) String description,
            @ToolParam(description = "Product variants/sizes. If it has no sizes, send a single one with "
                    + "name='Unidad'.") List<VariantInput> variants) {
        String branchesJson = client.get(businessId, role, branchesPath);
        if (ToolResult.isError(branchesJson)) {
            return "No se pudo obtener el listado de sucursales para armar los precios: " + branchesJson;
        }

        List<BranchDto> branches;
        try {
            branches = objectMapper.readValue(branchesJson, new TypeReference<List<BranchDto>>() {});
        } catch (JsonProcessingException e) {
            return "No se pudo interpretar el listado de sucursales: " + e.getMessage();
        }

        List<Map<String, Object>> variantBodies = new ArrayList<>();
        for (VariantInput variant : variants) {
            variantBodies.add(buildVariantBody(variant, branches));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("category_id", categoryId);
        body.put("product_type", productType);
        if (description != null) {
            body.put("description", description);
        }
        body.put("variants", variantBodies);

        String result = client.post(businessId, role, productsPath, body);
        if ("made".equalsIgnoreCase(productType)) {
            return ToolResult.withNote(result, RECIPE_REMINDER);
        }
        return result;
    }

    private Map<String, Object> buildVariantBody(VariantInput variant, List<BranchDto> branches) {
        List<Map<String, Object>> branchPriceBodies = new ArrayList<>();
        for (BranchDto branch : branches) {
            Map<String, Object> branchPrice = new LinkedHashMap<>();
            branchPrice.put("branch_id", branch.id());
            branchPrice.put("price", resolvePrice(branch.name(), variant));
            branchPriceBodies.add(branchPrice);
        }

        Map<String, Object> variantBody = new LinkedHashMap<>();
        variantBody.put("name", variant.name());
        variantBody.put("base_price", variant.basePrice());
        variantBody.put("branch_prices", branchPriceBodies);
        variantBody.put("recipes", List.of());
        return variantBody;
    }

    // A branch not explicitly overridden by the model falls back to base_price.
    private double resolvePrice(String branchName, VariantInput variant) {
        if (variant.branchPrices() == null) {
            return variant.basePrice();
        }
        return variant.branchPrices().stream()
                .filter(bp -> bp.branchName() != null && bp.branchName().trim().equalsIgnoreCase(branchName.trim()))
                .map(BranchPriceInput::price)
                .findFirst()
                .orElse(variant.basePrice());
    }

    public record VariantInput(
            @ToolParam(description = "Variant/size name (e.g. 'Chica', 'Mediana', or 'Unidad' if the product "
                    + "has no sizes)") String name,
            @ToolParam(description = "Base price, used for any branch that doesn't have a different price in "
                    + "branchPrices") Double basePrice,
            @Nullable
            @ToolParam(description = "Per-branch prices (optional). Leave empty/null if all branches use the "
                    + "base price.", required = false)
                    List<BranchPriceInput> branchPrices) {}

    public record BranchPriceInput(
            @ToolParam(description = "Branch name, exactly as it appears in getBranches") String branchName,
            @ToolParam(description = "Price for that branch") Double price) {}

    private record BranchDto(String id, String name) {}
}
