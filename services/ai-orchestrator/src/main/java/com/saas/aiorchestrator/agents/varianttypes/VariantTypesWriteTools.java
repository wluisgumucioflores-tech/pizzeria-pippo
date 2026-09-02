package com.saas.aiorchestrator.agents.varianttypes;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.LinkedHashMap;
import java.util.Map;

// Only bound to the ChatClient for role="admin" (see VariantTypesAgent). Not gated by
// allowed_write_domains — same criteria as categories/branches/ingredients (master data,
// the panel doesn't limit it by plan either).
public class VariantTypesWriteTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String variantTypesPath;

    public VariantTypesWriteTools(BackendAgentClient client, String businessId, String role,
            String variantTypesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.variantTypesPath = variantTypesPath;
    }

    @Tool(description = "Creates a new variant/size type name (e.g. 'Familiar') for the business to use later "
            + "when defining a product's variants. Before calling it, check with getVariantTypes that one with "
            + "the same name doesn't already exist.")
    public String createVariantType(@ToolParam(description = "Variant type name") String name) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("name", name);
        return client.post(businessId, role, variantTypesPath, body);
    }
}
