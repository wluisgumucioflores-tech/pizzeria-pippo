package com.saas.aiorchestrator.chat;

import com.saas.aiorchestrator.chat.dto.ToolChatRequest;
import com.saas.aiorchestrator.chat.dto.ToolChatResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Thin HTTP adapter — the actual orchestration lives in ChatOrchestrationService.
@RestController
public class AgentController {

    private final ChatOrchestrationService chatOrchestrationService;

    public AgentController(ChatOrchestrationService chatOrchestrationService) {
        this.chatOrchestrationService = chatOrchestrationService;
    }

    @PostMapping("/chat/tools")
    public ToolChatResponse chatWithTools(@RequestBody ToolChatRequest request) {
        return chatOrchestrationService.chatWithTools(request);
    }
}
