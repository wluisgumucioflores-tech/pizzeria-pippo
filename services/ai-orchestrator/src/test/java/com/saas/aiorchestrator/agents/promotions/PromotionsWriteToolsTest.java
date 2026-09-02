package com.saas.aiorchestrator.agents.promotions;

import com.saas.aiorchestrator.agents.promotions.PromotionsWriteTools.RuleInput;
import com.saas.aiorchestrator.backend.BackendAgentClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PromotionsWriteToolsTest {

    private static final String BUSINESS_ID = "business-1";
    private static final String ROLE = "admin";

    @Mock
    private BackendAgentClient client;

    private PromotionsWriteTools tools;

    @BeforeEach
    void setUp() {
        tools = new PromotionsWriteTools(client, BUSINESS_ID, ROLE, "/promotions");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> capturedBody() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(client).post(eq(BUSINESS_ID), eq(ROLE), eq("/promotions"), captor.capture());
        return (Map<String, Object>) captor.getValue();
    }

    @Test
    void buyXGetYSendsVariantAndQuantities() {
        when(client.post(eq(BUSINESS_ID), eq(ROLE), eq("/promotions"), any())).thenReturn("{\"id\":\"promo-1\"}");

        RuleInput rule = new RuleInput("variant-1", 1, 1, null, null, null, null);
        tools.createPromotion("2x1 Pizzas", "BUY_X_GET_Y", List.of(5, 6), "2026-09-01", "2026-09-30", null,
                List.of(rule));

        Map<String, Object> body = capturedBody();
        assertThat(body).containsEntry("name", "2x1 Pizzas");
        assertThat(body).containsEntry("type", "BUY_X_GET_Y");
        assertThat(body).containsEntry("days_of_week", List.of(5, 6));
        assertThat(body).containsEntry("start_date", "2026-09-01");
        assertThat(body).containsEntry("end_date", "2026-09-30");
        assertThat(body).containsEntry("branch_id", null);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rules = (List<Map<String, Object>>) body.get("rules");
        assertThat(rules).hasSize(1);
        assertThat(rules.get(0)).containsEntry("variant_id", "variant-1")
                .containsEntry("buy_qty", 1)
                .containsEntry("get_qty", 1)
                .containsEntry("discount_percent", null)
                .containsEntry("combo_price", null);
    }

    @Test
    void percentageWithoutVariantAppliesToAllProducts() {
        when(client.post(eq(BUSINESS_ID), eq(ROLE), eq("/promotions"), any())).thenReturn("{\"id\":\"promo-2\"}");

        RuleInput rule = new RuleInput(null, null, null, 20.0, null, null, null);
        tools.createPromotion("20% off todo", "PERCENTAGE", List.of(0, 1, 2, 3, 4, 5, 6), "2026-09-01",
                "2026-09-07", "branch-1", List.of(rule));

        Map<String, Object> body = capturedBody();
        assertThat(body).containsEntry("branch_id", "branch-1");

        @SuppressWarnings("unchecked")
        Map<String, Object> ruleBody = ((List<Map<String, Object>>) body.get("rules")).get(0);
        assertThat(ruleBody).containsEntry("variant_id", null).containsEntry("discount_percent", 20.0);
    }

    @Test
    void comboWithFlexibleSlotSendsCategoryAndSize() {
        when(client.post(eq(BUSINESS_ID), eq(ROLE), eq("/promotions"), any())).thenReturn("{\"id\":\"promo-3\"}");

        RuleInput comboSlot = new RuleInput(null, null, null, null, 50.0, "pizza", "Mediana");
        RuleInput flexibleSlot = new RuleInput(null, null, null, null, null, "bebida", null);
        tools.createPromotion("Combo Pizza+Bebida", "COMBO", List.of(0, 6), "2026-09-01", "2026-09-30", null,
                List.of(comboSlot, flexibleSlot));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rules = (List<Map<String, Object>>) capturedBody().get("rules");
        assertThat(rules).hasSize(2);
        assertThat(rules.get(0)).containsEntry("combo_price", 50.0).containsEntry("category", "pizza")
                .containsEntry("variant_size", "Mediana");
        assertThat(rules.get(1)).containsEntry("category", "bebida").containsEntry("combo_price", null);
    }
}
