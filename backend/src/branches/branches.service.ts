import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchHasCashiersException } from '../common/exceptions/branch-has-cashiers.exception';
import { BranchHasDependenciesException } from '../common/exceptions/branch-has-dependencies.exception';
import type { Branch } from '@pippo/shared';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { ListBranchesQueryDto } from './dto/list-branches-query.dto';
import type { CreateBranchDto } from './dto/create-branch.dto';
import type { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListBranchesQueryDto, user: CurrentUserPayload): Promise<Branch[]> {
    const showInactive = query.showInactive === 'true';

    const where = {
      businessId: this.resolveBusinessId(user),
      ...(showInactive ? {} : { isActive: true }),
      // Replicates the real RLS: admin sees all of their business, everyone else only their own branch
      ...(user.role === 'admin' ? {} : { id: user.branch_id ?? '' }),
    };

    const rows = await this.prisma.branch.findMany({ where, orderBy: { createdAt: 'asc' } });
    return rows.map((row) => this.mapBranch(row));
  }

  async create(dto: CreateBranchDto, user: CurrentUserPayload): Promise<Branch> {
    const row = await this.prisma.branch.create({
      data: {
        businessId: this.resolveBusinessId(user),
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        expectedStartTime: dto.expected_start_time,
      },
    });
    return this.mapBranch(row);
  }

  async update(id: string, dto: UpdateBranchDto, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.prisma.branch.update({
      where: { id },
      data: { name: dto.name, address: dto.address, phone: dto.phone, expectedStartTime: dto.expected_start_time },
    });
  }

  async setActive(id: string, isActive: boolean, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    if (!isActive) {
      await this.assertNoActiveCashiers(id);
    }
    await this.prisma.branch.update({ where: { id }, data: { isActive } });
  }

  // Hard delete real: a diferencia de setActive(false), esto borra la fila.
  // Solo se permite si la sucursal no tiene ningún dato asociado — de lo
  // contrario se rompería la integridad referencial de ventas/stock históricos.
  async remove(id: string, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.assertNoDependencies(id);
    await this.prisma.branch.delete({ where: { id } });
  }

  // Evita que un admin del negocio B opere sobre una sucursal del negocio A
  // conociendo su UUID — 404 en vez de 403 para no revelar que el id existe.
  private async assertOwnership(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const branch = await this.prisma.branch.findUnique({ where: { id }, select: { businessId: true } });
    if (!branch || branch.businessId !== businessId) {
      throw new NotFoundException('Sucursal no encontrada');
    }
  }

  private async assertNoActiveCashiers(branchId: string): Promise<void> {
    const cashiers = await this.prisma.profile.findMany({
      where: { branchId, role: 'cajero' },
      select: { id: true, fullName: true },
    });

    if (cashiers.length > 0) {
      throw new BranchHasCashiersException(
        `Hay ${cashiers.length} cajero(s) asignados a esta sucursal. Desactívalos o reasígnalos antes de continuar.`,
        cashiers.map((c) => ({ id: c.id, full_name: c.fullName })),
      );
    }
  }

  // Chequeo de solo existencia (findFirst + take:1), no de conteo: no
  // necesitamos el número exacto de filas y un `count()` fuerza escanear
  // todas las filas que matchean en vez de parar en la primera.
  private async assertNoDependencies(branchId: string): Promise<void> {
    const checks = await Promise.all([
      this.prisma.order.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.branchPrice.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.branchStock.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.stockMovement.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.branchProductStock.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.productStockMovement.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.promotion.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.device.findFirst({ where: { branchId }, select: { id: true } }),
      this.prisma.profile.findFirst({ where: { branchId }, select: { id: true } }),
    ]);

    if (checks.some((row) => row !== null)) {
      throw new BranchHasDependenciesException(
        'No se puede eliminar la sucursal: tiene datos asociados (ventas, stock, precios, usuarios, etc). Desactívala en su lugar.',
      );
    }
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }

  private mapBranch(row: { id: string; name: string; address: string | null; phone: string | null; createdAt: Date; isActive: boolean; expectedStartTime: string | null }): Branch {
    return {
      id: row.id,
      name: row.name,
      address: row.address,
      phone: row.phone,
      created_at: row.createdAt.toISOString(),
      is_active: row.isActive,
      expected_start_time: row.expectedStartTime,
    };
  }
}
