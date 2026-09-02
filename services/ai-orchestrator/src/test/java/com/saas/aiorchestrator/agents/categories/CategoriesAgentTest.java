package com.saas.aiorchestrator.agents.categories;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import com.saas.aiorchestrator.config.ToolPaths;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

// The one rule from Phase 10's role plumbing this whole feature exists for:
// only an admin-role chatter gets offered the tool that can create a
// category. A cajero (or anything else) only gets the read tool.
@ExtendWith(MockitoExtension.class)
class CategoriesAgentTest {

    private static final ToolPaths TOOL_PATHS = new ToolPaths(
            null, null, null, null, null, null, null, null, null, null, null, null, "/categories", null, null,
            null);

    @Mock
    private BackendAgentClient client;

    @Test
    void adminGetsReadAndWriteTools() {
        Object[] tools = new CategoriesAgent(client, TOOL_PATHS).tools("business-1", "admin", Set.of());

        assertThat(tools).hasSize(2);
        assertThat(tools).anyMatch(CategoriesTools.class::isInstance);
        assertThat(tools).anyMatch(CategoriesWriteTools.class::isInstance);
    }

    @Test
    void cajeroOnlyGetsReadTool() {
        Object[] tools = new CategoriesAgent(client, TOOL_PATHS).tools("business-1", "cajero", Set.of());

        assertThat(tools).hasSize(1);
        assertThat(tools[0]).isInstanceOf(CategoriesTools.class);
    }
}
