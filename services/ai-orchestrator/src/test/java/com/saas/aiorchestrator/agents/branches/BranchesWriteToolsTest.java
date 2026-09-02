package com.saas.aiorchestrator.agents.branches;

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
class BranchesWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private BranchesWriteTools tools;

    @BeforeEach
    void setUp() {
        tools = new BranchesWriteTools(client, BUSINESS_ID, ROLE, "/branches");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedBody() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/branches"), captor.capture());
        return (Map<String, Object>) captor.getValue();
    }

    @Test
    void createBranchSendsNameOnly() {
        tools.createBranch("Sucursal Norte", null, null, null);

        assertThat(capturedBody()).containsExactly(Map.entry("name", "Sucursal Norte"));
    }

    @Test
    void createBranchSendsOptionalFieldsWhenProvided() {
        tools.createBranch("Sucursal Sur", "Av. Siempre Viva 123", "555-1234", "08:00");

        assertThat(capturedBody()).containsExactly(
                Map.entry("name", "Sucursal Sur"),
                Map.entry("address", "Av. Siempre Viva 123"),
                Map.entry("phone", "555-1234"),
                Map.entry("expected_start_time", "08:00"));
    }
}
