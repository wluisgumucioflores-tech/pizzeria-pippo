package com.saas.aiorchestrator.chat;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

// In-memory only, lost on restart. A single shared bean — isolation comes from conversationId.
@Configuration
public class MemoryConfig {

    @Bean
    ChatMemory chatMemory() {
        return MessageWindowChatMemory.builder().build();
    }
}
