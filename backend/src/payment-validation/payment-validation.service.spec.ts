import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentValidationService } from './payment-validation.service';
import { OrdersGateway } from '../orders/realtime/orders.gateway';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUserPayload } from '../auth/types/jwt.types';

const cashier1: CurrentUserPayload = {
  id: 'cashier1',
  email: 'c1@pippo.local',
  role: 'cajero',
  branch_id: 'b1',
  full_name: 'Cajero 1',
  business_id: 'biz1',
};

const cashier2: CurrentUserPayload = {
  id: 'cashier2',
  email: 'c2@pippo.local',
  role: 'cajero',
  branch_id: 'b1',
  full_name: 'Cajero 2',
  business_id: 'biz1',
};

describe('PaymentValidationService', () => {
  let service: PaymentValidationService;
  let ordersGateway: { emitPaymentMatched: jest.Mock };
  let prisma: { branch: { findUnique: jest.Mock } };
  let now: number;

  beforeEach(async () => {
    now = Date.parse('2026-07-06T12:00:00.000Z');
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    ordersGateway = { emitPaymentMatched: jest.fn() };
    prisma = { branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentValidationService,
        { provide: OrdersGateway, useValue: ordersGateway },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PaymentValidationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('no emite match mientras no llega ninguna notificación', async () => {
    await service.start('b1', cashier1, 45);
    expect(ordersGateway.emitPaymentMatched).not.toHaveBeenCalled();
  });

  it('rechaza con 404 si la sucursal pertenece a otro negocio', async () => {
    prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });

    await expect(service.start('b1', cashier1, 45)).rejects.toThrow(NotFoundException);
  });

  it('emite match cuando llega una notificación con el mismo monto', async () => {
    const { requestId } = await service.start('b1', cashier1, 45);

    service.reportNotification('b1', 45, 'Juan Perez', 'Recibiste un pago de Bs45.00 de Juan Perez');

    expect(ordersGateway.emitPaymentMatched).toHaveBeenCalledWith('b1', {
      requestId,
      notificationId: expect.any(String),
      amount: 45,
      payerName: 'Juan Perez',
      rawText: 'Recibiste un pago de Bs45.00 de Juan Perez',
    });
  });

  it('no matchea notificaciones de otra sucursal', async () => {
    await service.start('b1', cashier1, 45);

    service.reportNotification('b2', 45, 'Juan Perez', 'texto');

    expect(ordersGateway.emitPaymentMatched).not.toHaveBeenCalled();
  });

  it('matchea de inmediato si la notificación llegó antes que el cajero apretara "Validar pago"', async () => {
    service.reportNotification('b1', 45, 'Juan Perez', 'texto');
    expect(ordersGateway.emitPaymentMatched).not.toHaveBeenCalled();

    const { requestId } = await service.start('b1', cashier1, 45);

    expect(ordersGateway.emitPaymentMatched).toHaveBeenCalledWith('b1', expect.objectContaining({ requestId, payerName: 'Juan Perez' }));
  });

  it('con dos requests pendientes del mismo monto, matchea el más antiguo primero (FIFO)', async () => {
    const { requestId: first } = await service.start('b1', cashier1, 45);
    now += 1000;
    await service.start('b1', cashier2, 45);

    service.reportNotification('b1', 45, 'Juan Perez', 'texto');

    expect(ordersGateway.emitPaymentMatched).toHaveBeenCalledTimes(1);
    expect(ordersGateway.emitPaymentMatched).toHaveBeenCalledWith('b1', expect.objectContaining({ requestId: first }));
  });

  it('un request ya matcheado no vuelve a matchear con una notificación nueva del mismo monto (le toca al siguiente en la fila)', async () => {
    const { requestId: first } = await service.start('b1', cashier1, 45);
    now += 1000;
    const { requestId: second } = await service.start('b1', cashier2, 45);

    service.reportNotification('b1', 45, 'Juan Perez', 'pago 1');
    expect(ordersGateway.emitPaymentMatched).toHaveBeenLastCalledWith('b1', expect.objectContaining({ requestId: first }));

    service.reportNotification('b1', 45, 'Maria Lopez', 'pago 2');
    expect(ordersGateway.emitPaymentMatched).toHaveBeenLastCalledWith('b1', expect.objectContaining({ requestId: second }));
  });

  it('"Actualizar" descarta el match y busca otro candidato ya guardado', async () => {
    const { requestId } = await service.start('b1', cashier1, 45);
    service.reportNotification('b1', 45, 'Persona Equivocada', 'texto 1');
    const firstNotificationId = ordersGateway.emitPaymentMatched.mock.calls[0][1].notificationId;

    service.reportNotification('b1', 45, 'Juan Perez', 'texto 2');
    service.reject(requestId, firstNotificationId);

    expect(ordersGateway.emitPaymentMatched).toHaveBeenCalledTimes(2);
    expect(ordersGateway.emitPaymentMatched).toHaveBeenLastCalledWith(
      'b1',
      expect.objectContaining({ requestId, payerName: 'Juan Perez' }),
    );
  });

  it('lanza NotFoundException si se rechaza un request que ya no existe', () => {
    expect(() => service.reject('no-existe', 'n1')).toThrow(NotFoundException);
  });

  it('"Cancelar" borra el request y una notificación posterior ya no lo matchea', async () => {
    const { requestId } = await service.start('b1', cashier1, 45);
    service.cancel(requestId);

    service.reportNotification('b1', 45, 'Juan Perez', 'texto');

    expect(ordersGateway.emitPaymentMatched).not.toHaveBeenCalled();
  });

  it('una notificación fuera de la ventana de tiempo ya no matchea (expiró)', async () => {
    await service.start('b1', cashier1, 45);

    now += 6 * 60 * 1000; // 6 min > 5 min default window
    service.reportNotification('b1', 45, 'Juan Perez', 'texto');

    expect(ordersGateway.emitPaymentMatched).not.toHaveBeenCalled();
  });
});
