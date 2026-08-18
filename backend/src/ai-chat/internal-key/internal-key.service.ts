import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordHasherService } from '../../auth/password/password-hasher.service';
import { SettingsService } from '../../settings/settings.service';
import type { CurrentUserPayload } from '../../auth/types/jwt.types';

@Injectable()
export class InternalKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly settingsService: SettingsService,
  ) {}

  // Generates (or reuses) the AI agent's "profile" for this business — a
  // real Profile row in the `profiles` table, not a synthetic user — because
  // JwtStrategy.validate() resolves the ENTIRE user context (role,
  // business_id, branch_id) by looking up `payload.sub` in that table; there
  // is no way to inject those claims directly into the JWT without touching
  // the existing guard. The agent gets role 'admin' (same approach as the
  // synthetic user in TelegramAiService) — the tool allowlist is the real
  // boundary, not the role.
  async generate(user: CurrentUserPayload): Promise<{ apiKey: string }> {
    const businessId = this.resolveBusinessId(user);
    const agentProfile = await this.findOrCreateAgentProfile(businessId);

    const apiKey = `pippo_aichat_${randomBytes(24).toString('base64url')}`;
    await this.settingsService.saveRawSettings(user, [
      { key: 'ai_chat_internal_api_key', value: apiKey },
      { key: 'ai_chat_agent_profile_id', value: agentProfile.id },
    ]);

    return { apiKey };
  }

  private async findOrCreateAgentProfile(businessId: string) {
    const email = `ai-chat-agent+${businessId}@internal.pizzeria-pippo`;
    const existing = await this.prisma.profile.findUnique({ where: { email } });
    if (existing) return existing;

    // Unusable password — this profile never logs in normally, it's only
    // used as the `sub` of short-lived JWTs signed by ToolExecutorService.
    const passwordHash = await this.passwordHasher.hash(
      randomBytes(32).toString('hex'),
    );
    return this.prisma.profile.create({
      data: {
        email,
        passwordHash,
        role: 'admin',
        businessId,
        fullName: 'Asistente IA (agente interno)',
      },
    });
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException(
        'El usuario no tiene un negocio asociado',
      );
    }
    return user.business_id;
  }
}
