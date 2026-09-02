package com.saas.aiorchestrator.agents.branches;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// Same rule as CategoriesAgentTest: only an admin-role chatter gets offered
// the tool that can create a branch. Not gated by allowedWriteDomains — the
// UI itself has no plan limit on branch count (see catalogo-tools.md).
@ExtendWith(MockitoExtension.class)
class BranchesAgentTest {

    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            null, null, null, null, null, null, null, null, null, null, null, null, null, "/branches", null, null);

    @Mock
    private BackendAgentClient client;

    @Test
    void adminGetsReadAndWriteTools() {
        Object[] tools = new BranchesAgent(client, TOOL_PATHS).tools("business-1", "admin", Set.of());

        assertThat(tools).hasSize(2);
        assertThat(tools).anyMatch(BranchesTools.class::isInstance);
        assertThat(tools).anyMatch(BranchesWriteTools.class::isInstance);
    }

    @Test
    void cajeroOnlyGetsReadTool() {
        Object[] tools = new BranchesAgent(client, TOOL_PATHS).tools("business-1", "cajero", Set.of());

        assertThat(tools).hasSize(1);
        assertThat(tools[0]).isInstanceOf(BranchesTools.class);
    }
}
