package com.saas.aiorchestrator.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

// Backend endpoint paths used by @Tool classes — a route change is a config edit, not a recompile.
@ConfigurationProperties(prefix = "tools.paths")
public record ToolPaths(
        String salesReport,
        String topProductsReport,
        String dailyReport,
        String cashiersReport,
        String ordersReport,
        String stock,
        String stockAlerts,
        String stockMovements,
        String stockPurchase,
        String stockAdjust,
        String promotions,
        String products,
        String categories,
        String branches,
        String ingredients,
        String variantTypes) {}
