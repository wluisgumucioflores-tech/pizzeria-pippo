package com.saas.aiorchestrator.tools;

import com.saas.aiorchestrator.backend.BackendAgentClient;

// Shared write-tool response shape: appends a note only to a successful call,
// never to one that already failed (would hide BackendAgentClient.ERROR_PREFIX).
public final class ToolResult {

    private ToolResult() {}

    public static boolean isError(String backendResult) {
        return backendResult != null && backendResult.startsWith(BackendAgentClient.ERROR_PREFIX);
    }

    public static String withNote(String backendResult, String note) {
        if (isError(backendResult) || note == null || note.isBlank()) {
            return backendResult;
        }
        return backendResult + " " + note;
    }
}
