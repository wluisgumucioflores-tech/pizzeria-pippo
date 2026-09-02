package com.saas.aiorchestrator.agents.promotions;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.lang.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

// Only bound to the ChatClient for role="admin" (see PromotionsAgent). One generic rule shape
// mirrors CreatePromotionDto/PromotionRuleInputDto on the backend — the meaning of each field
// depends on `type`, same as the admin panel's PromotionRules.tsx.
public class PromotionsWriteTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String promotionsPath;

    public PromotionsWriteTools(BackendAgentClient client, String businessId, String role, String promotionsPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.promotionsPath = promotionsPath;
    }

    @Tool(description = "Creates a new promotion. Before calling it: 1) if the user names specific products, "
            + "resolve their variant UUIDs with getProducts, 2) if the user names a specific branch, resolve it "
            + "with getBranches — otherwise leave branchId empty so it applies to every branch, 3) if startDate, "
            + "endDate or daysOfWeek weren't stated, ask the user instead of guessing, there's no default. The shape "
            + "of `rules` depends on `type`: for BUY_X_GET_Y each rule needs variantId+buyQty+getQty and there is "
            + "no 'all products' option — if the user wants it applied broadly, ask which specific product(s) it "
            + "covers; for PERCENTAGE one rule with discountPercent is enough, leave variantId empty to apply the "
            + "discount to every product; for COMBO set comboPrice only on the first rule, and each rule is either "
            + "a specific product (variantId) or a flexible slot (category and/or variantSize, both wildcards if "
            + "left empty).")
    public String createPromotion(
            @ToolParam(description = "Promotion name") String name,
            @ToolParam(description = "One of: BUY_X_GET_Y, PERCENTAGE, COMBO") String type,
            @ToolParam(description = "Days of week it applies to, 0=Sunday..6=Saturday. Ask the user if not "
                    + "stated, there is no default.") List<Integer> daysOfWeek,
            @ToolParam(description = "Start date, format YYYY-MM-DD") String startDate,
            @ToolParam(description = "End date, format YYYY-MM-DD") String endDate,
            @ToolParam(description = "Branch UUID, resolved with getBranches. Leave empty to apply to every "
                    + "branch.", required = false) String branchId,
            @ToolParam(description = "Promotion rules, see the tool description for the shape per type")
                    List<RuleInput> rules) {
        List<Map<String, Object>> ruleBodies = new ArrayList<>();
        for (RuleInput rule : rules) {
            ruleBodies.add(buildRuleBody(rule));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        body.put("type", type);
        body.put("days_of_week", daysOfWeek);
        body.put("start_date", startDate);
        body.put("end_date", endDate);
        body.put("branch_id", branchId);
        body.put("rules", ruleBodies);

        return client.post(businessId, role, promotionsPath, body);
    }

    private Map<String, Object> buildRuleBody(RuleInput rule) {
        Map<String, Object> ruleBody = new LinkedHashMap<>();
        ruleBody.put("variant_id", rule.variantId());
        ruleBody.put("buy_qty", rule.buyQty());
        ruleBody.put("get_qty", rule.getQty());
        ruleBody.put("discount_percent", rule.discountPercent());
        ruleBody.put("combo_price", rule.comboPrice());
        ruleBody.put("category", rule.category());
        ruleBody.put("variant_size", rule.variantSize());
        return ruleBody;
    }

    public record RuleInput(
            @Nullable
            @ToolParam(description = "Product variant UUID, resolved beforehand with getProducts. Required for "
                    + "BUY_X_GET_Y, optional for PERCENTAGE (empty = all products) and for a 'specific product' "
                    + "COMBO slot.", required = false) String variantId,
            @Nullable
            @ToolParam(description = "BUY_X_GET_Y only: quantity the customer pays for", required = false)
                    Integer buyQty,
            @Nullable
            @ToolParam(description = "BUY_X_GET_Y only: quantity the customer gets free", required = false)
                    Integer getQty,
            @Nullable
            @ToolParam(description = "PERCENTAGE only: discount percentage, 1-100", required = false)
                    Double discountPercent,
            @Nullable
            @ToolParam(description = "COMBO only, set on the first rule: fixed price for the whole combo",
                    required = false) Double comboPrice,
            @Nullable
            @ToolParam(description = "COMBO 'flexible slot' only: one of pizza, bebida, otro", required = false)
                    String category,
            @Nullable
            @ToolParam(description = "COMBO 'flexible slot' only: variant size name (e.g. 'Mediana')",
                    required = false) String variantSize) {}
}
