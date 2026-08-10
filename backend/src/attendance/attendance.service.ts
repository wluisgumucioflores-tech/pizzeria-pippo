import { BadRequestException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import { todayInBolivia, dateRangeFrom, dateRangeTo } from '../common/utils/timezone';
import type { CurrentUserPayload } from '../auth/types/jwt.types';
import type { ScanAttendanceDto } from './dto/scan-attendance.dto';
import type { AttendanceHistoryQueryDto } from './dto/attendance-history-query.dto';
import type { AttendanceScanResult, AttendanceHistoryRow } from './types/attendance-result.types';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeesService: EmployeesService,
  ) {}

  async scan(dto: ScanAttendanceDto): Promise<AttendanceScanResult> {
    if (!dto.token && !dto.manual_code) {
      throw new BadRequestException('Falta el token o el código de la credencial');
    }

    const employee = await this.employeesService.verifyCredential({ token: dto.token, manualCode: dto.manual_code });
    if (!employee) throw new UnauthorizedException('Credencial no reconocida');

    const todayStart = new Date(dateRangeFrom(todayInBolivia()));
    const todayEnd = new Date(dateRangeTo(todayInBolivia()));

    const last = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, createdAt: { gte: todayStart, lte: todayEnd } },
      orderBy: { createdAt: 'desc' },
    });

    const type: 'entrada' | 'salida' = !last || last.type === 'salida' ? 'entrada' : 'salida';

    const record = await this.prisma.attendanceRecord.create({
      data: { employeeId: employee.id, branchId: employee.branchId, type },
    });

    return {
      employee: { full_name: employee.fullName },
      type,
      occurred_at: record.createdAt.toISOString(),
    };
  }

  async history(query: AttendanceHistoryQueryDto, user: CurrentUserPayload): Promise<AttendanceHistoryRow[]> {
    const records = await this.prisma.attendanceRecord.findMany({
      where: {
        branch: { businessId: this.resolveBusinessId(user) },
        ...(query.branchId && { branchId: query.branchId }),
        ...((query.from || query.to) && {
          createdAt: {
            ...(query.from && { gte: new Date(dateRangeFrom(query.from)) }),
            ...(query.to && { lte: new Date(dateRangeTo(query.to)) }),
          },
        }),
      },
      include: { employee: true, branch: true },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      employee_name: record.employee.fullName,
      position: record.employee.position,
      branch_name: record.branch.name,
      type: record.type,
      created_at: record.createdAt.toISOString(),
    }));
  }

  private resolveBusinessId(user: CurrentUserPayload): string {
    if (!user.business_id) {
      throw new InternalServerErrorException('El usuario no tiene un negocio asociado');
    }
    return user.business_id;
  }
}
