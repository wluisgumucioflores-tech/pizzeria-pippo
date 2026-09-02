package com.saas.aiorchestrator.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

// MockRestServiceServer's default expectation (ExpectedCount.once()) fails
// the test on a second unexpected HTTP call — that's what actually proves
// the cache is being used, not just that fetch() returns a value.
class RuntimeConfigClientTest {

    private static final String BACKEND_URL = "http://backend.test";
    private static final String CONFIG_JSON =
            "{\"provider\":\"ollama\",\"model\":\"qwen3:8b\",\"baseURL\":null,\"apiKey\":null}";

    @Test
    void reusesCachedConfigForTheSameBusinessWithinTtl() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BACKEND_URL + "/ai-chat/runtime-config?businessId=business-1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(CONFIG_JSON, MediaType.APPLICATION_JSON));

        RuntimeConfigClient client =
                new RuntimeConfigClient(builder, BACKEND_URL, "internal-token", Duration.ofSeconds(30));

        RuntimeConfig first = client.fetch("business-1");
        RuntimeConfig second = client.fetch("business-1");

        assertThat(first).isEqualTo(second);
        assertThat(first.model()).isEqualTo("qwen3:8b");
        server.verify();
    }

    @Test
    void fetchesIndependentlyPerBusiness() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BACKEND_URL + "/ai-chat/runtime-config?businessId=business-1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(CONFIG_JSON, MediaType.APPLICATION_JSON));
        server.expect(requestTo(BACKEND_URL + "/ai-chat/runtime-config?businessId=business-2"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess(CONFIG_JSON, MediaType.APPLICATION_JSON));

        RuntimeConfigClient client =
                new RuntimeConfigClient(builder, BACKEND_URL, "internal-token", Duration.ofSeconds(30));

        client.fetch("business-1");
        client.fetch("business-2");

        server.verify();
    }
}
