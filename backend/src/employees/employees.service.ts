import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import { generateQrDataUrl } from '../common/utils/qr-code.util';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { CreateEmployeeDto } from './dto/create-employee.dto';
import type { UpdateEmployeeDto } from './dto/update-employee.dto';
import type { ListEmployeesQueryDto } from './dto/list-employees-query.dto';
import type { EmployeeResult, CreateEmployeeResult } from './types/employee-result.types';

export interface AuthenticatedEmployee {
  id: string;
  fullName: string;
  branchId: string;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
  ) {}

  async list(query: ListEmployeesQueryDto, user: CurrentUserPayload): Promise<EmployeeResult[]> {
    const showInactive = query.showInactive === 'true';

    const employees = await this.prisma.employee.findMany({
      where: {
        businessId: this.resolveBusinessId(user),
        ...(showInactive ? {} : { isActive: true }),
        ...(query.branchId && { branchId: query.branchId }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return employees.map(this.toResult);
  }

  async create(dto: CreateEmployeeDto, user: CurrentUserPayload): Promise<CreateEmployeeResult> {
    const { token, manualCode, credentialHash, manualCodeHash } = await this.generateCredential();

    const employee = await this.prisma.employee.create({
      data: {
        businessId: this.resolveBusinessId(user),
        branchId: dto.branch_id,
        fullName: dto.full_name,
        position: dto.position,
        credentialHash,
        manualCodeHash,
      },
    });

    return {
      employee: this.toResult(employee),
      credential: {
        token,
        manual_code: manualCode,
        qr_image_data_url: await generateQrDataUrl(this.buildFichaUrl(token)),
      },
    };
  }

  async update(id: string, dto: UpdateEmployeeDto, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.prisma.employee.update({
      where: { id },
      data: { branchId: dto.branch_id, fullName: dto.full_name, position: dto.position },
    });
  }

  async setActive(id: string, isActive: boolean, user: CurrentUserPayload): Promise<void> {
    await this.assertOwnership(id, user);
    await this.prisma.employee.update({ where: { id }, data: { isActive } });
  }

  // Invalida la credencial vieja (token + código) y genera una nueva —
  // misma forma de respuesta que create(), para reusar el mismo modal en el frontend.
  async regenerateCredential(id: string, user: CurrentUserPayload): Promise<CreateEmployeeResult> {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.businessId !== this.resolveBusinessId(user)) {
      throw new NotFoundException('Empleado no encontrado');
    }

    const { token, manualCode, credentialHash, manualCodeHash } = await this.generateCredential();

    const employee = await this.prisma.employee.update({
      where: { id },
      data: { credentialHash, manualCodeHash },
    });

    return {
      employee: this.toResult(employee),
      credential: {
        token,
        manual_code: manualCode,
        qr_image_data_url: await generateQrDataUrl(this.buildFichaUrl(token)),
      },
    };
  }

  // Llamado desde AttendanceService en cada escaneo/código tipeado. Los hashes
  // no son buscables por valor, así que compara contra todos los empleados
  // activos — aceptable a la escala de personal de una pizzería (mismo
  // trade-off ya aceptado en DevicesService.verifyApiKey).
  async verifyCredential(raw: { token?: string; manualCode?: string }): Promise<AuthenticatedEmployee | null> {
    const employees = await this.prisma.employee.findMany({ where: { isActive: true } });

    for (const employee of employees) {
      const matches = raw.token
        ? await this.passwordHasher.compare(raw.token, employee.credentialHash)
        : raw.manualCode
          ? await this.passwordHasher.compare(raw.manualCode, employee.manualCodeHash)
          : false;

      if (matches) {
        return { id: employee.id, fullName: employee.fullName, branchId: employee.branchId };
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

  // Evita que un admin del negocio B opere sobre un empleado del negocio A
  // conociendo su UUID — 404 en vez de 403 para no revelar que el id existe.
  private async assertOwnership(id: string, user: CurrentUserPayload): Promise<void> {
    const businessId = this.resolveBusinessId(user);
    const employee = await this.prisma.employee.findUnique({ where: { id }, select: { businessId: true } });
    if (!employee || employee.businessId !== businessId) {
      throw new NotFoundException('Empleado no encontrado');
    }
  }

  private async generateCredential() {
    const token = `pippo_emp_${randomBytes(24).toString('base64url')}`;
    const manualCode = String(randomInt(100000, 1000000));

    const [credentialHash, manualCodeHash] = await Promise.all([
      this.passwordHasher.hash(token),
      this.passwordHasher.hash(manualCode),
    ]);

    return { token, manualCode, credentialHash, manualCodeHash };
  }

  private buildFichaUrl(token: string): string {
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return `${frontendUrl}/fichar?t=${token}`;
  }

  private toResult(employee: {
    id: string;
    branchId: string;
    fullName: string;
    position: string;
    isActive: boolean;
    createdAt: Date;
  }): EmployeeResult {
    return {
      id: employee.id,
      branch_id: employee.branchId,
      full_name: employee.fullName,
      position: employee.position,
      is_active: employee.isActive,
      created_at: employee.createdAt.toISOString(),
    };
  }
}
