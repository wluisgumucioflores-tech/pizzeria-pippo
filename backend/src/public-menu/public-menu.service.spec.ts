import { Test, TestingModule } from '@nestjs/testing';
import { PublicMenuService } from './public-menu.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PublicMenuService', () => {
  let service: PublicMenuService;
  let prisma: {
    product: { findMany: jest.Mock };
    branch: { findMany: jest.Mock };
    business: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      product: { findMany: jest.fn() },
      branch: { findMany: jest.fn() },
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'biz1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PublicMenuService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PublicMenuService);
  });

  describe('listPizzas', () => {
    it('only queries active pizzas and maps to the public shape, without prices or recipes', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'p1',
          name: 'Margherita',
          description: 'Salsa, mozzarella y albahaca',
          imageUrl: 'https://cdn.example.com/margherita.jpg',
          variants: [{ name: 'Personal' }, { name: 'Familiar' }],
        },
      ]);

      const result = await service.listPizzas();

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true, category: 'pizza' } }),
      );
      expect(result).toEqual([
        {
          id: 'p1',
          name: 'Margherita',
          description: 'Salsa, mozzarella y albahaca',
          image_url: 'https://cdn.example.com/margherita.jpg',
          sizes: ['Personal', 'Familiar'],
        },
      ]);
    });

    it('returns an empty sizes array when a pizza has no active variants', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'p2', name: 'Especial', description: null, imageUrl: null, variants: [] },
      ]);

      const result = await service.listPizzas();

      expect(result[0].sizes).toEqual([]);
      expect(result[0].image_url).toBeNull();
    });
  });

  describe('listBranches', () => {
    it('only queries active branches', async () => {
      prisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Centro', address: 'Av. Siempre Viva 123', phone: '67106933' },
      ]);

      const result = await service.listBranches();

      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true } }),
      );
      expect(result).toEqual([{ id: 'b1', name: 'Centro', address: 'Av. Siempre Viva 123', phone: '67106933' }]);
    });
  });
});
