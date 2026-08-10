import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { UserResult } from './types/user-result.types';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async list(user: CurrentUserPayload): Promise<UserResult[]> {
    const businessId = this.resolveBusinessId(user);

    const [profiles, orders] = await Promise.all([
      this.prisma.profile.findMany({
        where: { businessId },
        select: { id: true, email: true, fullName: true, role: true, branchId: true, createdAt: true, isBanned: true },
      }),
      this.prisma.order.findMany({
        where: { branch: { businessId } },
        select: { cashierId: true },
        distinct: ['cashierId'],
      }),
    ]);

    const cashierIdsWithOrders = new Set(orders.map((o) => o.cashierId));

    return profiles.map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.fullName ?? '',
      role: p.role,
      branch_id: p.branchId,
      created_at: p.createdAt.toISOString(),
      is_banned: p.isBanned,
      has_orders: cashierIdsWithOrders.has(p.id),
    }));
  }

  async create(dto: CreateUserDto, user: CurrentUserPayload): Promise<{ id: string }> {
    const passwordHash = await this.passwordHasher.hash(dto.password);

    try {
      const profile = await this.prisma.profile.create({
        data: {
          businessId: this.resolveBusinessId(user),
          email: dto.email,
          passwordHash,
          fullName: dto.full_name,
          role: dto.role,
          branchId: dto.branch_id ?? null,
        },
      });
      return { id: profile.id };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw error;
    }
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  async update(id: string, dto: UpdateUserDto, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    const passwordHash = dto.password ? await this.passwordHasher.hash(dto.password) : undefined;

    await this.prisma.profile.update({
      where: { id },
      data: {
        fullName: dto.full_name,
        role: dto.role,
        branchId: dto.branch_id ?? null,
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
  }

  async toggleBan(id: string, banned: boolean, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.prisma.profile.update({ where: { id }, data: { isBanned: banned } });
  }

  async remove(id: string, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);

    const ordersCount = await this.prisma.order.count({ where: { cashierId: id } });
    if (ordersCount > 0) {
      throw new ConflictException(
        'No se puede eliminar: el usuario tiene ventas registradas. Desactiva la cuenta en su lugar.',
      );
    }
    await this.prisma.profile.delete({ where: { id } });
  }

  // Evita que un admin del negocio B pueda editar/banear/borrar un usuario del
  // negocio A conociendo su UUID — 404 en vez de 403 para no revelar que el id existe.
  private async assertOwnership(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const profile = await this.prisma.profile.findUnique({ where: { id }, select: { businessId: true } });
    if (!profile || profile.businessId !== businessId) {
      throw new NotFoundException('Usuario no encontrado');
    }
  }
}
