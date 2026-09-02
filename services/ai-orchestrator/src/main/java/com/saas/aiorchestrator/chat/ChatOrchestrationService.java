package com.saas.aiorchestrator.chat;

import com.saas.aiorchestrator.agents.AgentRegistry;
import com.saas.aiorchestrator.chat.dto.ToolChatRequest;
import com.saas.aiorchestrator.chat.dto.ToolChatResponse;
import com.saas.aiorchestrator.config.ChatDefaults;
import com.saas.aiorchestrator.config.ChatModelFactory;
import com.saas.aiorchestrator.config.RuntimeConfig;
import com.saas.aiorchestrator.config.RuntimeConfigClient;
import com.saas.aiorchestrator.config.SystemPromptClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Set;

// The actual chat/tools orchestration, pulled out of AgentController so the controller stays
// a thin HTTP adapter. A single ChatClient call resolves tool selection + execution + the final
// response — a separate "planner"/"ResponseAgent" step was evaluated and discarded (no proven
// benefit, double the latency/tokens per turn).
@Service
public class ChatOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(ChatOrchestrationService.class);

    private final RuntimeConfigClient runtimeConfigClient;
    private final SystemPromptClient systemPromptClient;
    private final AgentRegistry agentRegistry;
    private final ChatMemory chatMemory;
    private final ChatModelFactory chatModelFactory;
    private final MessageSource messageSource;
    private final ChatDefaults chatDefaults;

    public ChatOrchestrationService(
            RuntimeConfigClient runtimeConfigClient,
            SystemPromptClient systemPromptClient,
            AgentRegistry agentRegistry,
            ChatMemory chatMemory,
            ChatModelFactory chatModelFactory,
            MessageSource messageSource,
            ChatDefaults chatDefaults) {
        this.runtimeConfigClient = runtimeConfigClient;
        this.systemPromptClient = systemPromptClient;
        this.agentRegistry = agentRegistry;
        this.chatMemory = chatMemory;
        this.chatModelFactory = chatModelFactory;
        this.messageSource = messageSource;
        this.chatDefaults = chatDefaults;
    }

    public ToolChatResponse chatWithTools(ToolChatRequest request) {
        RuntimeConfig cfg = runtimeConfigClient.fetch(request.businessId());
        log.info(
                "chat/tools businessId={} provider={} model={} baseURL={}",
                request.businessId(), cfg.provider(), cfg.model(), cfg.baseURL());
        String locale = resolveLocale(request.locale());
        String systemPrompt = systemPromptClient.fetch(locale) + buildDateContext(locale)
                + buildBranchContext(request.branchId(), request.branchName(), locale);

        // Falls back to one conversation per business only for manual/smoke-test calls.
        String conversationId = resolveConversationId(request.conversationId(), request.businessId());

        ChatModel model = chatModelFactory.build(cfg);

        String role = resolveRole(request.role());
        Set<String> allowedWriteDomains = Set.copyOf(
                cfg.allowedWriteDomains() != null ? cfg.allowedWriteDomains() : List.of());
        Object[] tools = agentRegistry.toolsFor(request.businessId(), role, allowedWriteDomains);

        ChatTurnResult result = runTurn(model, systemPrompt, tools, request.message(), conversationId);

        return new ToolChatResponse(cfg.model(), cfg.baseURL(), result.reply(), result.promptTokens(),
                result.completionTokens());
    }

    // Runs one ChatClient turn against a fixed model/system-prompt/tool-set. Package-private and
    // reusable on purpose: a future multi-agent orchestrator (one call per sub-agent) would call
    // this once per agent instead of duplicating the ChatClient-building boilerplate.
    ChatTurnResult runTurn(ChatModel model, String systemPrompt, Object[] tools, String userMessage,
            String conversationId) {
        ChatClient chatClient = ChatClient.builder(model)
                .defaultSystem(systemPrompt)
                .defaultTools(tools)
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                .build();

        ChatResponse springResponse = chatClient.prompt(userMessage)
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
                .call()
                .chatResponse();

        String reply = springResponse.getResult().getOutput().getText();
        Usage usage = springResponse.getMetadata().getUsage();
        int promptTokens = usage != null ? usage.getPromptTokens() : 0;
        int completionTokens = usage != null ? usage.getCompletionTokens() : 0;

        return new ChatTurnResult(reply, promptTokens, completionTokens);
    }

    record ChatTurnResult(String reply, int promptTokens, int completionTokens) {}

    // Package-private so these fallbacks are directly testable without the full pipeline.
    String resolveLocale(String requestedLocale) {
        return requestedLocale != null ? requestedLocale : chatDefaults.defaultLocale();
    }

    String resolveRole(String requestedRole) {
        return requestedRole != null ? requestedRole : chatDefaults.defaultRole();
    }

    String resolveConversationId(String requestedConversationId, String businessId) {
        return requestedConversationId != null ? requestedConversationId : businessId;
    }

    // Models have no notion of "today" and invent dates for "yesterday"/"this month" otherwise
    // (seen with qwen2.5:3b-instruct) — computed fresh per request, template in messages*.properties.
    String buildDateContext(String locale) {
        String today = LocalDate.now(ZoneOffset.of(chatDefaults.timezoneOffset())).toString();
        return messageSource.getMessage("chat.date-context", new Object[] { today }, Locale.forLanguageTag(locale));
    }

    // branchId/branchName are pre-resolved by NestJS (AiChatProxyService) — the caller's only
    // visible branch, or their explicit pick among several. Telling the model up front means it
    // can pass branchId straight into report/stock tools without calling getBranches or asking
    // the user every turn (see catalogo-tools.md). null = no default, unchanged behavior.
    String buildBranchContext(String branchId, String branchName, String locale) {
        if (branchId == null) {
            return "";
        }
        return messageSource.getMessage(
                "chat.branch-context", new Object[] { branchName, branchId }, Locale.forLanguageTag(locale));
    }
}
