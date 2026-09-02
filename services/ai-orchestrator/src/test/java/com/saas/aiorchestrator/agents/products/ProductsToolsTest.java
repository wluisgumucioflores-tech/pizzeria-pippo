package com.saas.aiorchestrator.agents.products;

import com.saas.aiorchestrator.backend.BackendAgentClient;
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
class ProductsToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private ProductsTools tools;

    @BeforeEach
    void setUp() {
        tools = new ProductsTools(client, BUSINESS_ID, ROLE, "/products");
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getProductsWithNoParamsHitsBasePath() {
        tools.getProducts(null, null, null, null, null);

        assertThat(capturedPath()).isEqualTo("/products");
    }

    @Test
    void getProductsWithAllParams() {
        tools.getProducts("pepperoni", "cat-1", false, 1, 20);

        assertThat(capturedPath()).isEqualTo(
                "/products?search=pepperoni&category_id=cat-1&showInactive=false&page=1&pageSize=20");
    }
}
