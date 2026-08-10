import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmployeesService } from '../employees/employees.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: { attendanceRecord: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock } };
  let employeesService: { verifyCredential: jest.Mock };

  const employee = { id: 'e1', fullName: 'Juan Pérez', branchId: 'b1' };

  const admin: CurrentUserPayload = {
    id: 'u1',
    email: 'admin@pippo.local',
    role: 'admin',
    branch_id: null,
    full_name: 'Admin',
    business_id: 'biz1',
  };

  beforeEach(async () => {
    prisma = { attendanceRecord: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() } };
    employeesService = { verifyCredential: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  describe('scan', () => {
    it('lanza BadRequestException si no viene token ni manual_code', async () => {
      await expect(service.scan({})).rejects.toThrow(BadRequestException);
      expect(employeesService.verifyCredential).not.toHaveBeenCalled();
    });

    it('lanza UnauthorizedException si la credencial no matchea', async () => {
      employeesService.verifyCredential.mockResolvedValue(null);

      await expect(service.scan({ token: 'bad' })).rejects.toThrow(UnauthorizedException);
    });

    it('registra "entrada" si no hay ningún registro hoy', async () => {
      employeesService.verifyCredential.mockResolvedValue(employee);
      prisma.attendanceRecord.findFirst.mockResolvedValue(null);
      prisma.attendanceRecord.create.mockResolvedValue({ createdAt: new Date('2026-07-23T12:00:00Z') });

      const result = await service.scan({ token: 'ok' });

      expect(prisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: { employeeId: 'e1', branchId: 'b1', type: 'entrada' },
      });
      expect(result).toEqual({
        employee: { full_name: 'Juan Pérez' },
        type: 'entrada',
        occurred_at: '2026-07-23T12:00:00.000Z',
      });
    });

    it('registra "salida" si el último registro de hoy fue "entrada"', async () => {
      employeesService.verifyCredential.mockResolvedValue(employee);
      prisma.attendanceRecord.findFirst.mockResolvedValue({ type: 'entrada' });
      prisma.attendanceRecord.create.mockResolvedValue({ createdAt: new Date('2026-07-23T20:00:00Z') });

      const result = await service.scan({ manual_code: '123456' });

      expect(prisma.attendanceRecord.create).toHaveBeenCalledWith({
        data: { employeeId: 'e1', branchId: 'b1', type: 'salida' },
      });
      expect(result.type).toBe('salida');
    });

    it('registra "entrada" de nuevo si el último registro de hoy fue "salida"', async () => {
      employeesService.verifyCredential.mockResolvedValue(employee);
      prisma.attendanceRecord.findFirst.mockResolvedValue({ type: 'salida' });
      prisma.attendanceRecord.create.mockResolvedValue({ createdAt: new Date('2026-07-23T22:00:00Z') });

      const result = await service.scan({ token: 'ok' });

      expect(result.type).toBe('entrada');
    });
  });

  describe('history', () => {
    it('mapea los registros con nombre de empleado y sucursal', async () => {
      prisma.attendanceRecord.findMany.mockResolvedValue([
        {
          id: 'a1',
          type: 'entrada',
          createdAt: new Date('2026-07-23T12:00:00Z'),
          employee: { fullName: 'Juan Pérez', position: 'Delivery' },
          branch: { name: 'Centro' },
        },
      ]);

      const result = await service.history({}, admin);

      expect(result).toEqual([
        {
          id: 'a1',
          employee_name: 'Juan Pérez',
          position: 'Delivery',
          branch_name: 'Centro',
          type: 'entrada',
          created_at: '2026-07-23T12:00:00.000Z',
        },
      ]);
    });
  });
});
