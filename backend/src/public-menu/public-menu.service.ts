import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { PublicPizza } from './types/public-pizza.types';
import type { PublicBranch } from './types/public-branch.types';

// Deliberately separate from ProductsService/BranchesService: those return
// recipes, branch prices and role-scoped branch filtering meant for
// authenticated staff. This service only selects the fields safe to expose
// on the public, unauthenticated marketing site.
//
// No JWT means no business context — same "first business" pattern already
// used for the Telegram bot (SettingsService.getRawSettingsForFirstBusiness).
// Multitenant subdomains/branding are explicitly out of scope for this plan.
@Injectable()
export class PublicMenuService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveFirstBusinessId(): Promise<string | undefined> {
    const business = await this.prisma.business.findFirst();
    return business?.id;
  }

  async listPizzas(): Promise<PublicPizza[]> {
    const businessId = await this.resolveFirstBusinessId();
    const products = await this.prisma.product.findMany({
      where: { businessId, isActive: true, category: 'pizza' },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        variants: { where: { isActive: true }, select: { name: true }, orderBy: { basePrice: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      image_url: p.imageUrl,
      sizes: p.variants.map((v) => v.name),
    }));
  }

  async listBranches(): Promise<PublicBranch[]> {
    const businessId = await this.resolveFirstBusinessId();
    const branches = await this.prisma.branch.findMany({
      where: { businessId, isActive: true },
      select: { id: true, name: true, address: true, phone: true },
      orderBy: { name: 'asc' },
    });

    return branches;
  }
}
