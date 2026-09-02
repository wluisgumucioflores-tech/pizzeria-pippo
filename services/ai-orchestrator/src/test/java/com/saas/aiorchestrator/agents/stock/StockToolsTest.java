package com.saas.aiorchestrator.agents.stock;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class StockToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";
    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            null, null, null, null, null,
            "/stock", "/stock/alerts", "/stock/movements", null, null,
            null, null, null, null, null, null);

    @Mock
    private BackendAgentClient client;

    private StockTools tools;

    @BeforeEach
    void setUp() {
        tools = new StockTools(client, BUSINESS_ID, ROLE, TOOL_PATHS);
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getStockWithNoParamsHitsBasePath() {
        tools.getStock(null, null, null);

        assertThat(capturedPath()).isEqualTo("/stock");
    }

    @Test
    void getStockWithAllParams() {
        tools.getStock("branch-1", 2, 25);

        assertThat(capturedPath()).isEqualTo("/stock?branchId=branch-1&page=2&pageSize=25");
    }

    @Test
    void getStockAlertsWithBranch() {
        tools.getStockAlerts("branch-1");

        assertThat(capturedPath()).isEqualTo("/stock/alerts?branchId=branch-1");
    }

    @Test
    void getStockAlertsWithNoBranchHitsBasePath() {
        tools.getStockAlerts(null);

        assertThat(capturedPath()).isEqualTo("/stock/alerts");
    }

    @Test
    void getStockMovementsWithAllParams() {
        tools.getStockMovements("branch-1", "ingredient-1", "compra", 1, 10);

        assertThat(capturedPath()).isEqualTo(
                "/stock/movements?branchId=branch-1&ingredientId=ingredient-1&type=compra&page=1&pageSize=10");
    }

    @Test
    void getStockMovementsWithNoParamsHitsBasePath() {
        tools.getStockMovements(null, null, null, null, null);

        assertThat(capturedPath()).isEqualTo("/stock/movements");
    }
}
