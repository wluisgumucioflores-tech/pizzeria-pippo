package com.saas.aiorchestrator.agents.sales;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Optional;

// Not a @Component — built per-request bound to a fixed businessId, so the model
// can never choose which business to query.
public class SalesTools {

    private final BackendAgentClient client;
    private final String businessId;
    private final String role;
    private final ToolPaths toolPaths;

    public SalesTools(BackendAgentClient client, String businessId, String role, ToolPaths toolPaths) {
        this.client = client;
        this.businessId = businessId;
        this.role = role;
        this.toolPaths = toolPaths;
    }

    @Tool(description = "Gets the business's sales report: total sold, number of orders, average ticket. "
            + "If no dates are specified, returns today's sales.")
    public String getSalesReport(
            @ToolParam(description = "From date, format YYYY-MM-DD", required = false) String from,
            @ToolParam(description = "To date, format YYYY-MM-DD", required = false) String to,
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId) {
        return client.get(businessId, role, reportPath(toolPaths.salesReport(), from, to, branchId));
    }

    @Tool(description = "Gets the business's best-selling products in a date range. "
            + "If no dates are specified, returns today's ranking.")
    public String getTopProductsReport(
            @ToolParam(description = "From date, format YYYY-MM-DD", required = false) String from,
            @ToolParam(description = "To date, format YYYY-MM-DD", required = false) String to,
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId) {
        return client.get(businessId, role, reportPath(toolPaths.topProductsReport(), from, to, branchId));
    }

    @Tool(description = "Gets the business's daily sales report (day-by-day breakdown). "
            + "If no dates are specified, returns today's report.")
    public String getDailyReport(
            @ToolParam(description = "From date, format YYYY-MM-DD", required = false) String from,
            @ToolParam(description = "To date, format YYYY-MM-DD", required = false) String to,
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId) {
        return client.get(businessId, role, reportPath(toolPaths.dailyReport(), from, to, branchId));
    }

    @Tool(description = "Gets the sales report broken down by cashier. If no dates are specified, returns today's.")
    public String getCashiersReport(
            @ToolParam(description = "From date, format YYYY-MM-DD", required = false) String from,
            @ToolParam(description = "To date, format YYYY-MM-DD", required = false) String to,
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId,
            @ToolParam(description = "Cashier UUID, to filter by a single one", required = false) String cashierId) {
        String path = UriComponentsBuilder.fromPath(toolPaths.cashiersReport())
                .queryParamIfPresent("from", Optional.ofNullable(from))
                .queryParamIfPresent("to", Optional.ofNullable(to))
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .queryParamIfPresent("cashierId", Optional.ofNullable(cashierId))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }

    @Tool(description = "Gets the business's list of orders, paginated. If no dates are specified, "
            + "returns today's.")
    public String getOrdersReport(
            @ToolParam(description = "From date, format YYYY-MM-DD", required = false) String from,
            @ToolParam(description = "To date, format YYYY-MM-DD", required = false) String to,
            @ToolParam(description = "Branch UUID (get it with getBranches if the user gives a name)",
                    required = false) String branchId,
            @ToolParam(description = "Page number (starts at 1)", required = false) Integer page,
            @ToolParam(description = "Number of results per page", required = false) Integer pageSize) {
        String path = UriComponentsBuilder.fromPath(toolPaths.ordersReport())
                .queryParamIfPresent("from", Optional.ofNullable(from))
                .queryParamIfPresent("to", Optional.ofNullable(to))
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .queryParamIfPresent("page", Optional.ofNullable(page))
                .queryParamIfPresent("pageSize", Optional.ofNullable(pageSize))
                .build()
                .toUriString();
        return client.get(businessId, role, path);
    }

    // Shared by the three report endpoints that only take from/to/branchId; cashiers/orders build their own URI.
    private static String reportPath(String basePath, String from, String to, String branchId) {
        return UriComponentsBuilder.fromPath(basePath)
                .queryParamIfPresent("from", Optional.ofNullable(from))
                .queryParamIfPresent("to", Optional.ofNullable(to))
                .queryParamIfPresent("branchId", Optional.ofNullable(branchId))
                .build()
                .toUriString();
    }
}
