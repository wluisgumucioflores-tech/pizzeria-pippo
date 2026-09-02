package com.saas.aiorchestrator.agents.products;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// Same rule as CategoriesAgentTest: only an admin-role chatter gets offered
// the tool that can create a product. A cajero only gets the read tool.
@ExtendWith(MockitoExtension.class)
class ProductsAgentTest {

    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            null, null, null, null, null, null, null, null, null, null, null, "/products", null, "/branches", null,
            null);

    @Mock
    private BackendAgentClient client;

    @Test
    void adminGetsReadAndWriteTools() {
        Object[] tools = new ProductsAgent(client, TOOL_PATHS).tools("business-1", "admin", Set.of());

        assertThat(tools).hasSize(2);
        assertThat(tools).anyMatch(ProductsTools.class::isInstance);
        assertThat(tools).anyMatch(ProductsWriteTools.class::isInstance);
    }

    @Test
    void cajeroOnlyGetsReadTool() {
        Object[] tools = new ProductsAgent(client, TOOL_PATHS).tools("business-1", "cajero", Set.of());

        assertThat(tools).hasSize(1);
        assertThat(tools[0]).isInstanceOf(ProductsTools.class);
    }
}
