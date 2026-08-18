import { Injectable } from '@nestjs/common';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';
import {
  QueryAgentService,
  type ChatTurn,
} from '../agents/query-agent.service';
import type { ChatLocale } from '../agents/build-system-prompt';

// Currently a direct passthrough to the only agent available — there is no
// intent classification yet. This is the only place that would change the
// day a second specialized agent is added (e.g. SalesAgent): the routing
// logic for which agent handles each message would live here.
@Injectable()
export class OrchestratorService {
  constructor(private readonly queryAgent: QueryAgentService) {}

  async handleMessage(
    user: CurrentUserPayload,
    messages: ChatTurn[],
    locale: ChatLocale = 'es',
  ): Promise<{ content: string }> {
    const content = await this.queryAgent.run(user, messages, locale);
    return { content };
  }
}
