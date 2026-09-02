package com.saas.aiorchestrator.agents.varianttypes;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

public class VariantTypesTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final String variantTypesPath;

    public VariantTypesTools(BackendAgentClient client, String businessId, String role, String variantTypesPath) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.variantTypesPath = variantTypesPath;
    }

    @Tool(description = "Gets the business's catalog of variant/size type names (e.g. 'Chica', 'Mediana', "
            + "'Familiar') used when building a product's variants — not the product variants themselves "
            + "(those have a price and are created with createProduct).")
    public String getVariantTypes(
            @ToolParam(description = "If true, only returns active ones", required = false) Boolean onlyActive) {
        String path = UriComponentsBuilder.fromPath(variantTypesPath)
                .queryParamIfPresent("onlyActive", Optional.ofNullable(onlyActive).map(Object::toString))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }
}
