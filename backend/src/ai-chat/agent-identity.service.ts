import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';

// Own identity for the chat-ia orchestrator agent (Spring), independent
// of backend/src/mcp — that module is for external MCP clients (Claude,
// etc.), a different product surface. The chat-ia agent never uses
// the JWT of the user who opened the chat: it signs its own short-lived
// token, bound to a Profile dedicated per business.
const AGENT_JWT_TTL_SECONDS = 120;

@Injectable()
export class AgentIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
  ) {}

  // `role` is the real chatting user's role (admin/cajero), not a fixed
  // constant — the agent's JWT carries that same role, so what the agent
  // can write is bounded by the exact same @Roles(...) guards a human with
  // that role would hit, not by a universally-admin service account.
  async issueAgentToken(businessId: string, role: string): Promise<{ access_token: string }> {
    const agentProfile = await this.findOrCreateAgentProfile(businessId, role);
    return {
      access_token: this.jwtService.sign(
        { sub: agentProfile.id },
        { secret: process.env.JWT_SECRET, expiresIn: AGENT_JWT_TTL_SECONDS },
      ),
    };
  }

  // Same synthetic profile as issueAgentToken, but returned raw (no JWT) —
  // for callers that are already inside the NestJS process and can call
  // AiChatProxyService directly (e.g. the Telegram chat-ia webhook), instead
  // of round-tripping through a signed token they'd immediately decode back.
  async getOrCreateAgentProfile(businessId: string, role: string) {
    return this.findOrCreateAgentProfile(businessId, role);
  }

  // A real Profile, not a synthetic object — JwtStrategy.validate() resolves
  // ALL of the context (role, business_id, branch_id) by looking up `payload.sub` in
  // `profiles`. One synthetic profile per (businessId, role) pair — no branch,
  // since the endpoints the agent calls are scoped by business_id, not branch_id.
  private async findOrCreateAgentProfile(businessId: string, role: string) {
    const email = `ai-chat-agent+${role}+${businessId}@internal.pizzeria-pippo`;
    const existing = await this.prisma.profile.findUnique({ where: { email } });
    if (existing) return existing;

    const passwordHash = await this.passwordHasher.hash(randomBytes(32).toString('hex'));
    return this.prisma.profile.create({
      data: {
        email,
        passwordHash,
        role,
        businessId,
        fullName: `Agente Chat IA (${role})`,
      },
    });
  }
}
