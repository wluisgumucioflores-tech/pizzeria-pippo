package com.saas.aiorchestrator.agents.stock;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// Purchasing/adjusting stock needs both: role=admin AND the business's plan
// enabling the "stock" write domain (ai_chat_plans.limits.allowed_write_domains).
@ExtendWith(MockitoExtension.class)
class StockAgentTest {

    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            null, null, null, null, null, "/stock", "/stock/alerts", "/stock/movements",
            "/stock/purchase", "/stock/adjust", null, null, null, null, null, null);

    @Mock
    private BackendAgentClient client;

    @Test
    void adminWithDomainAllowedGetsReadAndWriteTools() {
        Object[] tools = new StockAgent(client, TOOL_PATHS).tools("business-1", "admin", Set.of("stock"));

        assertThat(tools).hasSize(2);
        assertThat(tools).anyMatch(StockTools.class::isInstance);
        assertThat(tools).anyMatch(StockWriteTools.class::isInstance);
    }

    @Test
    void adminWithoutDomainAllowedOnlyGetsReadTool() {
        Object[] tools = new StockAgent(client, TOOL_PATHS).tools("business-1", "admin", Set.of());

        assertThat(tools).hasSize(1);
        assertThat(tools[0]).isInstanceOf(StockTools.class);
    }

    @Test
    void cajeroWithDomainAllowedOnlyGetsReadTool() {
        Object[] tools = new StockAgent(client, TOOL_PATHS).tools("business-1", "cajero", Set.of("stock"));

        assertThat(tools).hasSize(1);
        assertThat(tools[0]).isInstanceOf(StockTools.class);
    }
}
