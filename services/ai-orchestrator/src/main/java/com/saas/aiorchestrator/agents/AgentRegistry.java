package com.saas.aiorchestrator.agents;

import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

// Spring injects every Agent bean here — a new capability is just a new @Component.
@Component
public class AgentRegistry {

    private final List<Agent> agents;

    public AgentRegistry(List<Agent> agents) {
        this.agents = agents;
    }

    public Object[] toolsFor(String businessId, String role, Set<String> allowedWriteDomains) {
        return agents.stream()
                .flatMap(agent -> java.util.Arrays.stream(agent.tools(businessId, role, allowedWriteDomains)))
                .toArray();
    }
}
