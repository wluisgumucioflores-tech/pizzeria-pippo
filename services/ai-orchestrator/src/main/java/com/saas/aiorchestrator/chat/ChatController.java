package com.saas.aiorchestrator.chat;

import com.saas.aiorchestrator.chat.dto.ChatRequest;
import com.saas.aiorchestrator.chat.dto.ChatResponse;
import com.saas.aiorchestrator.config.ChatModelFactory;
import com.saas.aiorchestrator.config.RuntimeConfig;
import com.saas.aiorchestrator.config.RuntimeConfigClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

// Smoke-test endpoint: no system prompt, no tools, no memory.
@RestController
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private final RuntimeConfigClient runtimeConfigClient;
    private final ChatModelFactory chatModelFactory;

    public ChatController(RuntimeConfigClient runtimeConfigClient, ChatModelFactory chatModelFactory) {
        this.runtimeConfigClient = runtimeConfigClient;
        this.chatModelFactory = chatModelFactory;
    }

    @PostMapping("/chat")
    public ChatResponse chat(@RequestBody ChatRequest request) {
        RuntimeConfig cfg = runtimeConfigClient.fetch(null);
        log.info("chat provider={} model={} baseURL={}", cfg.provider(), cfg.model(), cfg.baseURL());
        ChatModel model = chatModelFactory.build(cfg);

        String reply = model
                .call(new Prompt(request.message()))
                .getResult()
                .getOutput()
                .getText();

        return new ChatResponse(cfg.model(), cfg.baseURL(), reply);
    }
}
