package com.saas.aiorchestrator.agents.ingredients;

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
class IngredientsToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private IngredientsTools tools;

    @BeforeEach
    void setUp() {
        tools = new IngredientsTools(client, BUSINESS_ID, ROLE, "/ingredients");
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getIngredientsWithNoParamsHitsBasePath() {
        tools.getIngredients(null, null, null, null);

        assertThat(capturedPath()).isEqualTo("/ingredients");
    }

    @Test
    void getIngredientsWithAllParams() {
        tools.getIngredients("harina", false, 1, 20);

        assertThat(capturedPath()).isEqualTo("/ingredients?search=harina&showInactive=false&page=1&pageSize=20");
    }
}
