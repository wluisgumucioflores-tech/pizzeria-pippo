package com.saas.aiorchestrator.agents.products;

import com.saas.aiorchestrator.agents.products.ProductsWriteTools.BranchPriceInput;
import com.saas.aiorchestrator.agents.products.ProductsWriteTools.VariantInput;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProductsWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";
    private static final String ONE_BRANCH_JSON = "[{\"id\":\"branch-1\",\"name\":\"Centro\",\"is_active\":true}]";
    private static final String TWO_BRANCHES_JSON =
            "[{\"id\":\"branch-1\",\"name\":\"Centro\",\"is_active\":true},"
                    + "{\"id\":\"branch-2\",\"name\":\"Norte\",\"is_active\":true}]";

    @Mock
    private BackendAgentClient client;

    private ProductsWriteTools tools;

    @BeforeEach
    void setUp() {
        tools = new ProductsWriteTools(client, BUSINESS_ID, ROLE, "/products", "/branches");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedBody() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/products"), captor.capture());
        return (Map<String, Object>) captor.getValue();
    }

    @Test
    void singleBranchFillsBranchPriceWithBasePrice() {
        when(client.get(BUSINESS_ID, ROLE, "/branches")).thenReturn(ONE_BRANCH_JSON);
        when(client.post(eq(BUSINESS_ID), eq(ROLE), eq("/products"), any())).thenReturn("{\"id\":\"prod-1\"}");

        tools.createProduct("Pizza Cherry", "cat-1", "made", null,
                List.of(new VariantInput("Unidad", 35.0, null)));

        Map<String, Object> body = capturedBody();
        assertThat(body).containsEntry("name", "Pizza Cherry");
        assertThat(body).containsEntry("category_id", "cat-1");
        assertThat(body).containsEntry("product_type", "made");
        assertThat(body).doesNotContainKey("description");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> variants = (List<Map<String, Object>>) body.get("variants");
        assertThat(variants).hasSize(1);
        Map<String, Object> variant = variants.get(0);
        assertThat(variant).containsEntry("name", "Unidad").containsEntry("base_price", 35.0);
        assertThat(variant.get("recipes")).isEqualTo(List.of());

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> branchPrices = (List<Map<String, Object>>) variant.get("branch_prices");
        assertThat(branchPrices).containsExactly(Map.of("branch_id", "branch-1", "price", 35.0));
    }

    @Test
    void multipleBranchesUseOverrideByNameAndFallBackForTheRest() {
        when(client.get(BUSINESS_ID, ROLE, "/branches")).thenReturn(TWO_BRANCHES_JSON);
        when(client.post(eq(BUSINESS_ID), eq(ROLE), eq("/products"), any())).thenReturn("{\"id\":\"prod-1\"}");

        VariantInput variant = new VariantInput("Unidad", 30.0,
                List.of(new BranchPriceInput("norte", 40.0)));
        tools.createProduct("Pizza Cherry", "cat-1", "resale", "Descripción", List.of(variant));

        Map<String, Object> body = capturedBody();
        assertThat(body).containsEntry("description", "Descripción");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> branchPrices =
                (List<Map<String, Object>>) ((List<Map<String, Object>>) body.get("variants")).get(0)
                        .get("branch_prices");
        assertThat(branchPrices).containsExactlyInAnyOrder(
                Map.of("branch_id", "branch-1", "price", 30.0),
                Map.of("branch_id", "branch-2", "price", 40.0));
    }

    @Test
    void appendsRecipeReminderOnlyForMadeProducts() {
        when(client.get(BUSINESS_ID, ROLE, "/branches")).thenReturn(ONE_BRANCH_JSON);
        when(client.post(eq(BUSINESS_ID), eq(ROLE), eq("/products"), any())).thenReturn("{\"id\":\"prod-1\"}");

        String madeResult = tools.createProduct("Pizza", "cat-1", "made", null,
                List.of(new VariantInput("Unidad", 30.0, null)));
        String resaleResult = tools.createProduct("Gaseosa", "cat-2", "resale", null,
                List.of(new VariantInput("Unidad", 10.0, null)));

        assertThat(madeResult).contains("{\"id\":\"prod-1\"}").contains("receta");
        assertThat(resaleResult).isEqualTo("{\"id\":\"prod-1\"}");
    }

    @Test
    void doesNotCallPostWhenBranchesFetchFails() {
        when(client.get(BUSINESS_ID, ROLE, "/branches")).thenReturn("Error executing /branches: timeout");

        String result = tools.createProduct("Pizza", "cat-1", "made", null,
                List.of(new VariantInput("Unidad", 30.0, null)));

        assertThat(result).contains("Error executing /branches");
        verify(client, never()).post(any(), any(), any(), any());
    }
}
