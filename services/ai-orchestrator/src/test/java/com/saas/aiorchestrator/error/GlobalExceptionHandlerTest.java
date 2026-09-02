package com.saas.aiorchestrator.error;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestClientException;

import static org.assertj.core.api.Assertions.assertThat;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void mapsUpstreamFailuresToBadGateway() {
        ResponseEntity<GlobalExceptionHandler.ErrorResponse> response =
                handler.handleUpstreamFailure(new RestClientException("connection refused"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_GATEWAY);
        assertThat(response.getBody().error()).isEqualTo("No se pudo comunicar con el backend.");
    }

    @Test
    void mapsInvalidConfigurationToInternalServerError() {
        ResponseEntity<GlobalExceptionHandler.ErrorResponse> response =
                handler.handleInvalidConfiguration(new IllegalArgumentException("Unknown ai_models.provider: qwen"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().error()).isEqualTo("Configuración de IA inválida para este negocio.");
    }

    @Test
    void mapsAnyOtherExceptionToInternalServerError() {
        ResponseEntity<GlobalExceptionHandler.ErrorResponse> response =
                handler.handleUnexpected(new RuntimeException("boom"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().error()).isEqualTo("Ocurrió un error inesperado.");
    }
}
