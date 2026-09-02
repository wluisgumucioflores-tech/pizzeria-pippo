package com.saas.aiorchestrator.tools;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ToolResultTest {

    @Test
    void isErrorDetectsBackendAgentClientErrorPrefix() {
        assertThat(ToolResult.isError("Error executing /products: timeout")).isTrue();
        assertThat(ToolResult.isError("{\"id\":\"prod-1\"}")).isFalse();
    }

    @Test
    void withNoteAppendsNoteToASuccessfulResult() {
        String result = ToolResult.withNote("{\"id\":\"prod-1\"}", "Nota: agregá la receta.");

        assertThat(result).isEqualTo("{\"id\":\"prod-1\"} Nota: agregá la receta.");
    }

    @Test
    void withNoteLeavesAnErrorResultUntouched() {
        String errorResult = "Error executing /products: timeout";

        assertThat(ToolResult.withNote(errorResult, "Nota: agregá la receta.")).isEqualTo(errorResult);
    }

    @Test
    void withNoteLeavesTheResultUntouchedWhenThereIsNoNote() {
        assertThat(ToolResult.withNote("{\"id\":\"prod-1\"}", null)).isEqualTo("{\"id\":\"prod-1\"}");
        assertThat(ToolResult.withNote("{\"id\":\"prod-1\"}", "  ")).isEqualTo("{\"id\":\"prod-1\"}");
    }
}
