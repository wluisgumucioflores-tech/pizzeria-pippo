import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { DeviceResult } from './types/device-result.types';
import type { CreateDeviceDto } from './dto/create-device.dto';
import type { UpdateDeviceDto } from './dto/update-device.dto';

export interface AuthenticatedDevice {
  id: string;
  branchId: string;
}

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async list(user: CurrentUserPayload): Promise<DeviceResult[]> {
    const devices = await this.prisma.device.findMany({
      where: { businessId: this.resolveBusinessId(user) },
      orderBy: { createdAt: 'desc' },
    });
    return devices.map(this.toResult);
  }

  // Returns the raw API key alongside the created device — it's only ever
  // shown this one time, only the bcrypt hash is persisted (same pattern
  // as a GitHub PAT).
  async create(dto: CreateDeviceDto, user: CurrentUserPayload): Promise<{ device: DeviceResult; apiKey: string }> {
    const apiKey = `pippo_dev_${randomBytes(24).toString('base64url')}`;
    const apiKeyHash = await this.passwordHasher.hash(apiKey);

    const device = await this.prisma.device.create({
      data: { businessId: this.resolveBusinessId(user), branchId: dto.branch_id, name: dto.name, apiKeyHash },
    });

    return { device: this.toResult(device), apiKey };
  }

  async update(id: string, dto: UpdateDeviceDto, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const device = await this.prisma.device.findUnique({ where: { id }, select: { businessId: true } });
    if (!device || device.businessId !== businessId) {
      throw new NotFoundException('Dispositivo no encontrado');
    }
    await this.prisma.device.update({
      where: { id },
      data: { name: dto.name, isActive: dto.is_active },
    });
  }

  // Called by ApiKeyGuard on every request from a device. Bcrypt hashes can't
  // be looked up by value, so this compares against every active device —
  // fine at the scale of a handful of phones per branch.
  async verifyApiKey(rawApiKey: string): Promise<AuthenticatedDevice | null> {
    const devices = await this.prisma.device.findMany({ where: { isActive: true } });

    for (const device of devices) {
      const matches = await this.passwordHasher.compare(rawApiKey, device.apiKeyHash);
      if (matches) {
        await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
        return { id: device.id, branchId: device.branchId };
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

  private toResult(device: {
    id: string;
    branchId: string;
    name: string;
    isActive: boolean;
    lastSeenAt: Date | null;
    createdAt: Date;
  }): DeviceResult {
    return {
      id: device.id,
      branch_id: device.branchId,
      name: device.name,
      is_active: device.isActive,
      last_seen_at: device.lastSeenAt?.toISOString() ?? null,
      created_at: device.createdAt.toISOString(),
    };
  }
}
