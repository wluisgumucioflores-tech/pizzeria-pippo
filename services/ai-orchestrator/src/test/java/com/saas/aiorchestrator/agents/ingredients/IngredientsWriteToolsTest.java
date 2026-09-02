package com.saas.aiorchestrator.agents.ingredients;

import com.saas.aiorchestrator.backend.BackendAgentClient;
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
class IngredientsWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private IngredientsWriteTools tools;

    @BeforeEach
    void setUp() {
        tools = new IngredientsWriteTools(client, BUSINESS_ID, ROLE, "/ingredients");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedBody() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/ingredients"), captor.capture());
        return (Map<String, Object>) captor.getValue();
    }

    @Test
    void createIngredientSendsNameAndUnitOnly() {
        tools.createIngredient("Harina", "kg", null);

        assertThat(capturedBody()).containsExactly(Map.entry("name", "Harina"), Map.entry("unit", "kg"));
    }

    @Test
    void createIngredientSendsIsSharedUseWhenProvided() {
        tools.createIngredient("Queso mozzarella", "kg", true);

        assertThat(capturedBody()).containsExactly(
                Map.entry("name", "Queso mozzarella"),
                Map.entry("unit", "kg"),
                Map.entry("is_shared_use", true));
    }
}
