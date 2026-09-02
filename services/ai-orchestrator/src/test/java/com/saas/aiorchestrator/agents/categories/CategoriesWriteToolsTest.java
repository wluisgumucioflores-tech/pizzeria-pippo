package com.saas.aiorchestrator.agents.categories;

import com.saas.aiorchestrator.backend.BackendAgentClient;
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
class CategoriesWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    @Test
    void createCategorySendsNameOnly() {
        new CategoriesWriteTools(client, BUSINESS_ID, ROLE, "/categories").createCategory("Bebidas", null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/categories"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsExactly(Map.entry("name", "Bebidas"));
    }

    @Test
    void createCategorySendsIsPizzaWhenProvided() {
        new CategoriesWriteTools(client, BUSINESS_ID, ROLE, "/categories").createCategory("Pizzas", true);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/categories"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsExactly(Map.entry("name", "Pizzas"), Map.entry("is_pizza", true));
    }
}
