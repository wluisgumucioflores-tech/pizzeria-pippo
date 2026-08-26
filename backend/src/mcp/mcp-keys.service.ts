import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { McpKeyResult } from './types/mcp-key-result.types';
import type { CreateMcpKeyDto } from './dto/create-mcp-key.dto';
import type { UpdateMcpKeyDto } from './dto/update-mcp-key.dto';

export interface AuthenticatedMcpKey {
  id: string;
  businessId: string;
}

@Injectable()
export class McpKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async list(user: CurrentUserPayload): Promise<McpKeyResult[]> {
    const keys = await this.prisma.mcpApiKey.findMany({
      where: { businessId: this.resolveBusinessId(user) },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(this.toResult);
  }

  // Returns the raw API key alongside the created row — only ever shown
  // this one time, only the bcrypt hash is persisted (same pattern as
  // DevicesService.create and a GitHub PAT).
  async create(dto: CreateMcpKeyDto, user: CurrentUserPayload): Promise<{ key: McpKeyResult; apiKey: string }> {
    const apiKey = `pippo_mcp_${randomBytes(24).toString('base64url')}`;
    const apiKeyHash = await this.passwordHasher.hash(apiKey);

    const key = await this.prisma.mcpApiKey.create({
      data: { businessId: this.resolveBusinessId(user), name: dto.name, apiKeyHash },
    });

    return { key: this.toResult(key), apiKey };
  }

  async update(id: string, dto: UpdateMcpKeyDto, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const key = await this.prisma.mcpApiKey.findUnique({ where: { id }, select: { businessId: true } });
    if (!key || key.businessId !== businessId) {
      throw new NotFoundException('API key no encontrada');
    }
    await this.prisma.mcpApiKey.update({
      where: { id },
      data: { name: dto.name, isActive: dto.is_active },
    });
  }

  // Called by McpAuthService on every /mcp/token exchange. Bcrypt hashes
  // can't be looked up by value, so this compares against every active key
  // — fine at the scale of a handful of MCP integrations per business
  // (same tradeoff as DevicesService.verifyApiKey).
  async verifyApiKey(rawApiKey: string): Promise<AuthenticatedMcpKey | null> {
    const keys = await this.prisma.mcpApiKey.findMany({ where: { isActive: true } });

    for (const key of keys) {
      const matches = await this.passwordHasher.compare(rawApiKey, key.apiKeyHash);
      if (matches) {
        await this.prisma.mcpApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
        return { id: key.id, businessId: key.businessId };
      }
    }

    return null;
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  private toResult(key: {
    id: string;
    name: string;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
  }): McpKeyResult {
    return {
      id: key.id,
      name: key.name,
      is_active: key.isActive,
      last_used_at: key.lastUsedAt?.toISOString() ?? null,
      created_at: key.createdAt.toISOString(),
    };
  }
}
