package com.saas.aiorchestrator.agents.sales;

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

// Locks down the URI each @Tool method builds before handing it to
// BackendAgentClient — the actual HTTP call is out of scope here (see
// BackendAgentClientTest), this is about the query string construction:
// right param names, right order, and no stray "?" when the model omits
// optional args.
@ExtendWith(MockitoExtension.class)
class SalesToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";
    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            "/reports/sales",
            "/reports/top-products",
            "/reports/daily",
            "/reports/cashiers",
            "/reports/orders",
            null, null, null, null, null, null, null, null, null, null, null);

    @Mock
    private BackendAgentClient client;

    private SalesTools tools;

    @BeforeEach
    void setUp() {
        tools = new SalesTools(client, BUSINESS_ID, ROLE, TOOL_PATHS);
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getSalesReportWithNoParamsHitsBasePath() {
        tools.getSalesReport(null, null, null);

        assertThat(capturedPath()).isEqualTo("/reports/sales");
    }

    @Test
    void getSalesReportWithAllParamsBuildsQueryString() {
        tools.getSalesReport("2026-08-01", "2026-08-31", "branch-1");

        assertThat(capturedPath()).isEqualTo("/reports/sales?from=2026-08-01&to=2026-08-31&branchId=branch-1");
    }

    @Test
    void getTopProductsReportWithAllParams() {
        tools.getTopProductsReport("2026-08-01", "2026-08-31", "branch-1");

        assertThat(capturedPath())
                .isEqualTo("/reports/top-products?from=2026-08-01&to=2026-08-31&branchId=branch-1");
    }

    @Test
    void getDailyReportWithAllParams() {
        tools.getDailyReport("2026-08-01", "2026-08-31", "branch-1");

        assertThat(capturedPath()).isEqualTo("/reports/daily?from=2026-08-01&to=2026-08-31&branchId=branch-1");
    }

    @Test
    void getCashiersReportWithAllParams() {
        tools.getCashiersReport("2026-08-01", "2026-08-31", "branch-1", "cashier-1");

        assertThat(capturedPath()).isEqualTo(
                "/reports/cashiers?from=2026-08-01&to=2026-08-31&branchId=branch-1&cashierId=cashier-1");
    }

    @Test
    void getCashiersReportWithNoParamsHitsBasePath() {
        tools.getCashiersReport(null, null, null, null);

        assertThat(capturedPath()).isEqualTo("/reports/cashiers");
    }

    @Test
    void getOrdersReportWithAllParams() {
        tools.getOrdersReport("2026-08-01", "2026-08-31", "branch-1", 2, 50);

        assertThat(capturedPath()).isEqualTo(
                "/reports/orders?from=2026-08-01&to=2026-08-31&branchId=branch-1&page=2&pageSize=50");
    }

    @Test
    void getOrdersReportWithNoParamsHitsBasePath() {
        tools.getOrdersReport(null, null, null, null, null);

        assertThat(capturedPath()).isEqualTo("/reports/orders");
    }
}
