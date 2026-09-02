package com.saas.aiorchestrator.agents.varianttypes;

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
class VariantTypesToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private VariantTypesTools tools;

    @BeforeEach
    void setUp() {
        tools = new VariantTypesTools(client, BUSINESS_ID, ROLE, "/variant-types");
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getVariantTypesWithNoParamsHitsBasePath() {
        tools.getVariantTypes(null);

        assertThat(capturedPath()).isEqualTo("/variant-types");
    }

    @Test
    void getVariantTypesWithOnlyActiveTrue() {
        tools.getVariantTypes(true);

        assertThat(capturedPath()).isEqualTo("/variant-types?onlyActive=true");
    }
}
