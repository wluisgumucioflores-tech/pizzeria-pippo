package com.saas.aiorchestrator.backend;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

// Covers the bug fixed in Phase 10 hardening: issueAgentToken() failures
// must come back as a bounded string, not an unhandled exception thrown up
// through the ChatClient tool-execution loop.
class BackendAgentClientTest {

    private static final String BACKEND_URL = "http://backend.test";

    @Test
    void returnsBoundedErrorWhenTokenIssuanceFails() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BACKEND_URL + "/ai-chat/agent-token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withServerError());

        BackendAgentClient client = new BackendAgentClient(builder, BACKEND_URL, "internal-token");

        String result = client.get("business-1", "admin", "/reports/sales");

        assertThat(result).startsWith("Error executing /reports/sales:");
    }

    @Test
    void returnsBackendBodyOnSuccess() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BACKEND_URL + "/ai-chat/agent-token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"tok-123\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(BACKEND_URL + "/reports/sales"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"total\":100}", MediaType.APPLICATION_JSON));

        BackendAgentClient client = new BackendAgentClient(builder, BACKEND_URL, "internal-token");

        String result = client.get("business-1", "admin", "/reports/sales");

        assertThat(result).isEqualTo("{\"total\":100}");
    }
}
