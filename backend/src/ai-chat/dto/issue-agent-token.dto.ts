import { IsIn, IsUUID } from 'class-validator';

export class IssueAgentTokenDto {
  @IsUUID()
  businessId!: string;

  // The real chatting user's role — the agent's own JWT is scoped to it
  // (see AgentIdentityService), so NestJS's existing @Roles(...) guards on
  // write endpoints are a real backstop, not decorative, if tool-gating in
  // the orchestrator itself ever had a bug.
  @IsIn(['admin', 'cajero'])
  role!: string;
}
