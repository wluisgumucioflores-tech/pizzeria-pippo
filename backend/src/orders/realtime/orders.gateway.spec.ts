import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { OrdersGateway } from './orders.gateway';
import { AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('OrdersGateway', () => {
  let gateway: OrdersGateway;
  let authService: { resolveUserFromToken: jest.Mock };
  let prisma: { branch: { findUnique: jest.Mock } };

  function fakeClient(handshake: { auth?: object; query?: object }) {
    return {
      handshake,
      join: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
    };
  }

  beforeEach(async () => {
    authService = { resolveUserFromToken: jest.fn() };
    prisma = { branch: { findUnique: jest.fn().mockResolvedValue({ businessId: 'biz1' }) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersGateway,
        { provide: AuthService, useValue: authService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gateway = module.get(OrdersGateway);
  });

  it('desconecta si no viene token en el handshake', async () => {
    const client = fakeClient({ auth: {}, query: {} });

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
    expect(authService.resolveUserFromToken).not.toHaveBeenCalled();
  });

  it('desconecta si el token es inválido', async () => {
    authService.resolveUserFromToken.mockRejectedValue(new UnauthorizedException());
    const client = fakeClient({ auth: { token: 'malo' }, query: {} });

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('une al cliente a la sala de su propia sucursal cuando no viene branchId en la query', async () => {
    authService.resolveUserFromToken.mockResolvedValue({ id: 'u1', role: 'cajero', branch_id: 'b1', full_name: 'x', business_id: null });
    const client = fakeClient({ auth: { token: 'bueno' }, query: {} });

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('branch:b1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('prioriza el branchId de la query sobre el del perfil (admin eligiendo sucursal de su propio negocio)', async () => {
    authService.resolveUserFromToken.mockResolvedValue({ id: 'u1', role: 'admin', branch_id: null, full_name: 'x', business_id: 'biz1' });
    const client = fakeClient({ auth: { token: 'bueno' }, query: { branchId: 'b2' } });

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('branch:b2');
  });

  it('desconecta si no hay ninguna sucursal resoluble (admin sin sucursal fija ni query)', async () => {
    authService.resolveUserFromToken.mockResolvedValue({ id: 'u1', role: 'admin', branch_id: null, full_name: 'x', business_id: 'biz1' });
    const client = fakeClient({ auth: { token: 'bueno' }, query: {} });

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('desconecta a un admin que pide el branchId de una sucursal de OTRO negocio', async () => {
    authService.resolveUserFromToken.mockResolvedValue({ id: 'u1', role: 'admin', branch_id: null, full_name: 'x', business_id: 'biz1' });
    prisma.branch.findUnique.mockResolvedValue({ businessId: 'otro-negocio' });
    const client = fakeClient({ auth: { token: 'bueno' }, query: { branchId: 'branch-de-otro-negocio' } });

    await gateway.handleConnection(client as never);

    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });

  it('ignora el branchId de la query si el usuario no es admin — siempre se une a su propia sucursal', async () => {
    authService.resolveUserFromToken.mockResolvedValue({ id: 'u1', role: 'cajero', branch_id: 'b1', full_name: 'x', business_id: 'biz1' });
    const client = fakeClient({ auth: { token: 'bueno' }, query: { branchId: 'b2-de-otro-negocio' } });

    await gateway.handleConnection(client as never);

    expect(client.join).toHaveBeenCalledWith('branch:b1');
    expect(prisma.branch.findUnique).not.toHaveBeenCalled();
  });
});
