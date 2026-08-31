import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from './password/password-hasher.service';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: { verify: jest.Mock; sign: jest.Mock };
  let prisma: { profile: { findUnique: jest.Mock; update: jest.Mock } };
  let passwordHasher: { compare: jest.Mock; hash: jest.Mock };

  const profile = {
    id: 'u1',
    email: 'cajero@pippo.local',
    passwordHash: 'hashed',
    isBanned: false,
    role: 'cajero',
    branchId: 'b1',
    fullName: 'Cajero',
    businessId: 'biz1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    jwtService = { verify: jest.fn(), sign: jest.fn().mockReturnValue('signed-token') };
    prisma = { profile: { findUnique: jest.fn(), update: jest.fn() } };
    passwordHasher = { compare: jest.fn(), hash: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordHasherService, useValue: passwordHasher },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('devuelve un access_token y el usuario si las credenciales son correctas', async () => {
      prisma.profile.findUnique.mockResolvedValue(profile);
      passwordHasher.compare.mockResolvedValue(true);

      const result = await service.login('cajero@pippo.local', 'plain-password');

      expect(passwordHasher.compare).toHaveBeenCalledWith('plain-password', 'hashed');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 'u1' },
        expect.objectContaining({ expiresIn: expect.anything() }),
      );
      expect(result).toEqual({
        access_token: 'signed-token',
        user: {
          id: 'u1',
          email: 'cajero@pippo.local',
          role: 'cajero',
          branch_id: 'b1',
          full_name: 'Cajero',
          business_id: 'biz1',
        },
      });
    });

    it('rechaza si el email no existe', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.login('nadie@pippo.local', 'x')).rejects.toThrow(UnauthorizedException);
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });

    it('rechaza con el mismo mensaje si el usuario está baneado', async () => {
      prisma.profile.findUnique.mockResolvedValue({ ...profile, isBanned: true });

      await expect(service.login('cajero@pippo.local', 'plain-password')).rejects.toThrow(UnauthorizedException);
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });

    it('rechaza si la contraseña no coincide', async () => {
      prisma.profile.findUnique.mockResolvedValue(profile);
      passwordHasher.compare.mockResolvedValue(false);

      await expect(service.login('cajero@pippo.local', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza con el mismo mensaje si el negocio está suspendido', async () => {
      prisma.profile.findUnique.mockResolvedValue({ ...profile, business: { isActive: false } });

      await expect(service.login('cajero@pippo.local', 'plain-password')).rejects.toThrow(UnauthorizedException);
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });

    it('permite el login de superadmin sin negocio asociado', async () => {
      prisma.profile.findUnique.mockResolvedValue({ ...profile, businessId: null, business: null, role: 'superadmin' });
      passwordHasher.compare.mockResolvedValue(true);

      await expect(service.login('cajero@pippo.local', 'plain-password')).resolves.toBeDefined();
    });
  });

  describe('resolveUserFromToken', () => {
    it('resuelve el usuario a partir de un token válido', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1' });
      prisma.profile.findUnique.mockResolvedValue(profile);

      const result = await service.resolveUserFromToken('token-valido');

      expect(result).toEqual({
        id: 'u1',
        email: 'cajero@pippo.local',
        role: 'cajero',
        branch_id: 'b1',
        full_name: 'Cajero',
        business_id: 'biz1',
      });
    });

    it('rechaza si el token es inválido o expiró', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.resolveUserFromToken('token-vencido')).rejects.toThrow(UnauthorizedException);
      expect(prisma.profile.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza si el perfil no existe', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u404' });
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.resolveUserFromToken('token-valido')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza si el perfil está baneado', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1' });
      prisma.profile.findUnique.mockResolvedValue({ ...profile, isBanned: true });

      await expect(service.resolveUserFromToken('token-valido')).rejects.toThrow(UnauthorizedException);
    });

    it('rechaza si el negocio del perfil está suspendido', async () => {
      jwtService.verify.mockReturnValue({ sub: 'u1' });
      prisma.profile.findUnique.mockResolvedValue({ ...profile, business: { isActive: false } });

      await expect(service.resolveUserFromToken('token-valido')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    it('actualiza el password si la contraseña actual es correcta', async () => {
      prisma.profile.findUnique.mockResolvedValue(profile);
      passwordHasher.compare.mockResolvedValue(true);
      passwordHasher.hash.mockResolvedValue('nuevo-hash');

      await service.changePassword('u1', 'actual', 'nueva-password');

      expect(passwordHasher.compare).toHaveBeenCalledWith('actual', 'hashed');
      expect(passwordHasher.hash).toHaveBeenCalledWith('nueva-password');
      expect(prisma.profile.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { passwordHash: 'nuevo-hash' },
      });
    });

    it('rechaza si la contraseña actual no coincide', async () => {
      prisma.profile.findUnique.mockResolvedValue(profile);
      passwordHasher.compare.mockResolvedValue(false);

      await expect(service.changePassword('u1', 'incorrecta', 'nueva-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.profile.update).not.toHaveBeenCalled();
    });

    it('rechaza si el usuario no existe', async () => {
      prisma.profile.findUnique.mockResolvedValue(null);

      await expect(service.changePassword('u404', 'actual', 'nueva-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(passwordHasher.compare).not.toHaveBeenCalled();
    });
  });
});
