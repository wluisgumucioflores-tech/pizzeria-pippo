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

class SystemPromptClientTest {

    private static final String BACKEND_URL = "http://backend.test";

    @Test
    void reusesCachedPromptForTheSameLocaleWithinTtl() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BACKEND_URL + "/ai-chat/system-prompt?locale=es"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"locale\":\"es\",\"content\":\"Sos el asistente de Pippo.\"}",
                        MediaType.APPLICATION_JSON));

        SystemPromptClient client =
                new SystemPromptClient(builder, BACKEND_URL, "internal-token", Duration.ofSeconds(30));

        String first = client.fetch("es");
        String second = client.fetch("es");

        assertThat(first).isEqualTo("Sos el asistente de Pippo.");
        assertThat(second).isEqualTo(first);
        server.verify();
    }

    @Test
    void fetchesIndependentlyPerLocale() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo(BACKEND_URL + "/ai-chat/system-prompt?locale=es"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"locale\":\"es\",\"content\":\"Contenido ES\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo(BACKEND_URL + "/ai-chat/system-prompt?locale=en"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"locale\":\"en\",\"content\":\"Content EN\"}", MediaType.APPLICATION_JSON));

        SystemPromptClient client =
                new SystemPromptClient(builder, BACKEND_URL, "internal-token", Duration.ofSeconds(30));

        assertThat(client.fetch("es")).isEqualTo("Contenido ES");
        assertThat(client.fetch("en")).isEqualTo("Content EN");
        server.verify();
    }
}
