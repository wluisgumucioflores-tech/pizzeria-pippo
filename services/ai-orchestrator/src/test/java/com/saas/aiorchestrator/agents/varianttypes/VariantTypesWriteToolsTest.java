package com.saas.aiorchestrator.agents.varianttypes;

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
class VariantTypesWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private VariantTypesWriteTools tools;

    @BeforeEach
    void setUp() {
        tools = new VariantTypesWriteTools(client, BUSINESS_ID, ROLE, "/variant-types");
    }

    @Test
    void createVariantTypeSendsName() {
        tools.createVariantType("Familiar");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> bodyCaptor = ArgumentCaptor.forClass(Map.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/variant-types"), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue()).containsExactly(Map.entry("name", "Familiar"));
    }
}
