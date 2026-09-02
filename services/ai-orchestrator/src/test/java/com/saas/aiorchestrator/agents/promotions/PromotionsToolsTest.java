package com.saas.aiorchestrator.agents.promotions;

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
class PromotionsToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private PromotionsTools tools;

    @BeforeEach
    void setUp() {
        tools = new PromotionsTools(client, BUSINESS_ID, ROLE, "/promotions");
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getPromotionsWithNoParamsHitsBasePath() {
        tools.getPromotions(null, null, null);

        assertThat(capturedPath()).isEqualTo("/promotions");
    }

    @Test
    void getPromotionsWithAllParams() {
        tools.getPromotions("branch-1", true, "2026-08-15");

        assertThat(capturedPath()).isEqualTo("/promotions?branchId=branch-1&showInactive=true&date=2026-08-15");
    }
}
