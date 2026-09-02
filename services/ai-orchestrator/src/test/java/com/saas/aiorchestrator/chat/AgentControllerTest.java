package com.saas.aiorchestrator.chat;

import com.saas.aiorchestrator.chat.dto.ToolChatRequest;
import com.saas.aiorchestrator.chat.dto.ToolChatResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

// AgentController is now a thin HTTP adapter — the only thing worth locking
// down here is that it actually delegates and returns the service's result
// unchanged. The real orchestration logic is covered by
// ChatOrchestrationServiceTest.
@ExtendWith(MockitoExtension.class)
class AgentControllerTest {

    @Mock
    private ChatOrchestrationService chatOrchestrationService;

    @Test
    void delegatesToChatOrchestrationServiceAndReturnsItsResult() {
        ToolChatRequest request = new ToolChatRequest("hola", "business-1", "es", "conv-1", "admin", null, null);
        ToolChatResponse expected = new ToolChatResponse("qwen3:8b", null, "respuesta", 10, 20);
        when(chatOrchestrationService.chatWithTools(request)).thenReturn(expected);

        AgentController controller = new AgentController(chatOrchestrationService);
        ToolChatResponse actual = controller.chatWithTools(request);

        assertThat(actual).isEqualTo(expected);
        verify(chatOrchestrationService).chatWithTools(request);
    }
}
