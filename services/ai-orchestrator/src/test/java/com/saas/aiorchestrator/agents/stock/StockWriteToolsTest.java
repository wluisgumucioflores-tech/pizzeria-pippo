package com.saas.aiorchestrator.agents.stock;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class StockWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";
    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            null, null, null, null, null, "/stock", "/stock/alerts", "/stock/movements",
            "/stock/purchase", "/stock/adjust", null, null, null, null, null, null);

    @Mock
    private BackendAgentClient client;

    private StockWriteTools tools;

    @BeforeEach
    void setUp() {
        tools = new StockWriteTools(client, BUSINESS_ID, ROLE, TOOL_PATHS);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedBody(String path) {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq(path), captor.capture());
        return (Map<String, Object>) captor.getValue();
    }

    @Test
    void purchaseStockWithoutMinQuantity() {
        tools.purchaseStock("branch-1", "ingredient-1", 50.0, null);

        assertThat(capturedBody("/stock/purchase")).containsExactly(
                Map.entry("branch_id", "branch-1"),
                Map.entry("ingredient_id", "ingredient-1"),
                Map.entry("quantity", 50.0));
    }

    @Test
    void purchaseStockWithMinQuantity() {
        tools.purchaseStock("branch-1", "ingredient-1", 50.0, 10.0);

        assertThat(capturedBody("/stock/purchase")).containsEntry("min_quantity", 10.0);
    }

    @Test
    void adjustStockWithoutNotes() {
        tools.adjustStock("branch-1", "ingredient-1", 30.0, null);

        assertThat(capturedBody("/stock/adjust")).containsExactly(
                Map.entry("branch_id", "branch-1"),
                Map.entry("ingredient_id", "ingredient-1"),
                Map.entry("real_quantity", 30.0));
    }

    @Test
    void adjustStockWithNotes() {
        tools.adjustStock("branch-1", "ingredient-1", 30.0, "merma");

        assertThat(capturedBody("/stock/adjust")).containsEntry("notes", "merma");
    }
}
