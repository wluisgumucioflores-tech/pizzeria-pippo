import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import { McpKeysService } from './mcp-keys.service';

// Intentionally short — mcp-saas re-exchanges the API key for a new token
// whenever this one expires (or the backend answers 401), so it never
// needs a long-lived session. Keeps the blast radius of a leaked token
// (logs, network capture) small compared to the permanent API key.
const AGENT_JWT_TTL_SECONDS = 300;

@Injectable()
export class McpAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly jwtService: JwtService,
    private readonly mcpKeysService: McpKeysService,
  ) {}

  async exchangeToken(rawApiKey: string): Promise<{ access_token: string }> {
    const key = await this.mcpKeysService.verifyApiKey(rawApiKey);
    if (!key) throw new UnauthorizedException('API key inválido');

    const agentProfile = await this.findOrCreateAgentProfile(key.businessId);

    return {
      access_token: this.jwtService.sign(
        { sub: agentProfile.id },
        { secret: process.env.JWT_SECRET, expiresIn: AGENT_JWT_TTL_SECONDS },
      ),
    };
  }

  // A real Profile row, not a synthetic user object — JwtStrategy.validate()
  // resolves the ENTIRE user context (role, business_id, branch_id) by
  // looking up `payload.sub` in `profiles`; there is no way to inject those
  // claims directly into the JWT without touching JwtAuthGuard/JwtStrategy,
  // which every other controller also depends on. The agent gets role
  // 'admin' (the allowlisted read-only tools are the real access boundary,
  // not this role) and no branch — the read-only endpoints it's allowed to
  // call all scope by business_id, not branch_id.
  private async findOrCreateAgentProfile(businessId: string) {
    const email = `mcp-agent+${businessId}@internal.pizzeria-pippo`;
    const existing = await this.prisma.profile.findUnique({ where: { email } });
    if (existing) return existing;

    const passwordHash = await this.passwordHasher.hash(randomBytes(32).toString('hex'));
    return this.prisma.profile.create({
      data: {
        email,
        passwordHash,
        role: 'admin',
        businessId,
        fullName: 'Agente MCP (interno)',
      },
    });
  }
}
