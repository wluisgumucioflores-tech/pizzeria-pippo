package com.saas.aiorchestrator.backend;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

// Calls NestJS directly (not through services/mcp-saas) with a fresh
// short-lived agent JWT per call — no caching, a new 120s token per tool-call
// is cheap next to the LLM call itself.
@Component
public class BackendAgentClient {

    // Shared with ToolResult.isError() so a write-tool that appends a note to
    // a successful call can tell it apart from a bounded failure without
    // re-declaring the same literal in a second place.
    public static final String ERROR_PREFIX = "Error executing ";

    private final RestClient restClient;
    private final String internalToken;

    public BackendAgentClient(
            RestClient.Builder builder,
            @Value("${backend.url}") String backendUrl,
            @Value("${backend.internal-token}") String internalToken) {
        this.restClient = builder.baseUrl(backendUrl).build();
        this.internalToken = internalToken;
    }

    // Carries the real chatting user's role so NestJS's @Roles(...) guards apply as they would to that human.
    private String issueAgentToken(String businessId, String role) {
        return restClient.post()
                .uri("/ai-chat/agent-token")
                .header("X-Internal-Token", internalToken)
                .body(new IssueAgentTokenRequest(businessId, role))
                .retrieve()
                .body(AgentTokenResponse.class)
                .accessToken();
    }

    // Bounds any failure (token issuance or the GET itself) to a string instead of throwing,
    // so it never breaks the ChatClient tool-execution loop.
    public String get(String businessId, String role, String path) {
        try {
            String token = issueAgentToken(businessId, role);
            return restClient.get()
                    .uri(path)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(String.class);
        } catch (Exception e) {
            return ERROR_PREFIX + path + ": " + e.getMessage();
        }
    }

    // POST against a real backend endpoint (write tools) — same identity and
    // error-bounding as get() above.
    public String post(String businessId, String role, String path, Object body) {
        try {
            String token = issueAgentToken(businessId, role);
            return restClient.post()
                    .uri(path)
                    .header("Authorization", "Bearer " + token)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        } catch (Exception e) {
            return ERROR_PREFIX + path + ": " + e.getMessage();
        }
    }

    private record IssueAgentTokenRequest(String businessId, String role) {}

    private record AgentTokenResponse(@JsonProperty("access_token") String accessToken) {}
}
