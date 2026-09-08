package com.saas.aiorchestrator.chat;

import com.saas.aiorchestrator.config.ChatDefaults;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;

import java.time.LocalDate;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

// Exercises exactly the two things flagged as easy to silently regress: the
// request-fallback branches (role/locale/conversationId, now sourced from
// ChatDefaults instead of hardcoded constants) and the date injected into
// the system prompt — resolved through the real
// messages.properties/messages_en.properties on the classpath, not a stub,
// so a broken resource key or a dropped {0} placeholder actually fails this.
// Deliberately does NOT stand up the full ChatClient/tool-registry/memory
// pipeline (see this class's own comment on why that's a single native
// Spring AI call) — that would mean mocking Spring AI internals this test
// has no need to depend on.
class ChatOrchestrationServiceTest {

    private static final ChatDefaults CHAT_DEFAULTS = new ChatDefaults("es", "admin", "-04:00");
    private static final ZoneOffset BOLIVIA_OFFSET = ZoneOffset.of("-04:00");

    private final ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();

    ChatOrchestrationServiceTest() {
        messageSource.setBasename("messages");
        messageSource.setDefaultEncoding("UTF-8");
        // Mirrors spring.messages.fallback-to-system-locale=false in
        // application.yml — without it this test only passes on a machine
        // whose OS locale happens to be Spanish (see the bug that config
        // line fixes: an "es" request silently returned the English bundle
        // on a host with an English OS locale).
        messageSource.setFallbackToSystemLocale(false);
    }

    private ChatOrchestrationService serviceWithRealMessageSource() {
        return new ChatOrchestrationService(null, null, null, null, null, messageSource, CHAT_DEFAULTS);
    }

    @Test
    void resolveLocaleFallsBackToConfiguredDefaultWhenNotProvided() {
        ChatOrchestrationService service = serviceWithRealMessageSource();

        assertThat(service.resolveLocale(null)).isEqualTo("es");
        assertThat(service.resolveLocale("en")).isEqualTo("en");
    }

    @Test
    void resolveRoleFallsBackToConfiguredDefaultWhenNotProvided() {
        ChatOrchestrationService service = serviceWithRealMessageSource();

        assertThat(service.resolveRole(null)).isEqualTo("admin");
        assertThat(service.resolveRole("cajero")).isEqualTo("cajero");
    }

    @Test
    void resolveConversationIdFallsBackToBusinessIdWhenNotProvided() {
        ChatOrchestrationService service = serviceWithRealMessageSource();

        assertThat(service.resolveConversationId(null, "business-1")).isEqualTo("business-1");
        assertThat(service.resolveConversationId("business-1:user-1", "business-1")).isEqualTo("business-1:user-1");
    }

    @Test
    void buildDateContextInSpanishIncludesTodaysConfiguredTimezoneDate() {
        String today = LocalDate.now(BOLIVIA_OFFSET).toString();

        String context = serviceWithRealMessageSource().buildDateContext("es");

        assertThat(context).contains(today).contains("Hoy es").doesNotContain("{0}");
    }

    @Test
    void buildDateContextInEnglishIncludesTodaysConfiguredTimezoneDate() {
        String today = LocalDate.now(BOLIVIA_OFFSET).toString();

        String context = serviceWithRealMessageSource().buildDateContext("en");

        assertThat(context).contains(today).contains("Today's date is").doesNotContain("{0}");
    }

    @Test
    void buildBranchContextReturnsEmptyWhenBranchIdIsNull() {
        String context = serviceWithRealMessageSource().buildBranchContext(null, null, "es");

        assertThat(context).isEmpty();
    }

    @Test
    void buildBranchContextInSpanishIncludesNameAndId() {
        String context = serviceWithRealMessageSource().buildBranchContext("branch-1", "Centro", "es");

        assertThat(context).contains("Centro").contains("branch-1").doesNotContain("{0}").doesNotContain("{1}");
    }

    @Test
    void buildBranchContextInEnglishIncludesNameAndId() {
        String context = serviceWithRealMessageSource().buildBranchContext("branch-1", "Centro", "en");

        assertThat(context).contains("Centro").contains("branch-1").doesNotContain("{0}").doesNotContain("{1}");
    }

    @Test
    void buildBusinessContextReturnsEmptyWhenBusinessNameIsNull() {
        String context = serviceWithRealMessageSource().buildBusinessContext(null, "es");

        assertThat(context).isEmpty();
    }

    @Test
    void buildBusinessContextInSpanishIncludesBusinessName() {
        String context = serviceWithRealMessageSource().buildBusinessContext("Pizzería Don Mario", "es");

        assertThat(context).contains("Pizzería Don Mario").doesNotContain("{0}");
    }

    @Test
    void buildBusinessContextInEnglishIncludesBusinessName() {
        String context = serviceWithRealMessageSource().buildBusinessContext("Pizzería Don Mario", "en");

        assertThat(context).contains("Pizzería Don Mario").doesNotContain("{0}");
    }
}
