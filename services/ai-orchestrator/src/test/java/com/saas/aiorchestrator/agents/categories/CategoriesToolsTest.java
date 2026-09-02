package com.saas.aiorchestrator.agents.categories;

import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class CategoriesToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    @Test
    void getCategoriesHitsBasePath() {
        // No query params for this endpoint — the only thing worth locking
        // down is that it calls the right path with the right businessId.
        new CategoriesTools(client, BUSINESS_ID, ROLE, "/categories").getCategories();

        verify(client).get(eq(BUSINESS_ID), eq(ROLE), eq("/categories"));
    }
}
