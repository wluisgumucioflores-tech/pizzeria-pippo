package com.saas.aiorchestrator.agents.branches;

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
class BranchesToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private BranchesTools tools;

    @BeforeEach
    void setUp() {
        tools = new BranchesTools(client, BUSINESS_ID, ROLE, "/branches");
    }

    private String capturedPath() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        verify(client).get(eq(BUSINESS_ID), eq(ROLE), captor.capture());
        return captor.getValue();
    }

    @Test
    void getBranchesWithNoParamsHitsBasePath() {
        tools.getBranches(null);

        assertThat(capturedPath()).isEqualTo("/branches");
    }

    @Test
    void getBranchesWithShowInactiveTrue() {
        tools.getBranches(true);

        assertThat(capturedPath()).isEqualTo("/branches?showInactive=true");
    }
}
