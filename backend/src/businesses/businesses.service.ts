import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordHasherService } from '../auth/password/password-hasher.service';
import { CategoriesService } from '../categories/categories.service';
import type { BusinessResult } from './types/business-result.types';
import type { CreateBusinessDto } from './dto/create-business.dto';
import type { UpdateBusinessDto } from './dto/update-business.dto';
import { BUSINESS_MODULE_KEYS, DEFAULT_ENABLED_MODULES, type EnabledModules } from '@pippo/shared';

interface AiChatPlanLimits {
  messages_per_day?: number | null;
}

type BusinessWithPlan = Prisma.BusinessGetPayload<{ include: { aiChatPlan: true } }>;

function pickValidModules(input: Partial<Record<string, unknown>> | undefined): Partial<EnabledModules> {
  if (!input) return {};
  const result: Partial<EnabledModules> = {};
  for (const key of BUSINESS_MODULE_KEYS) {
    if (typeof input[key] === 'boolean') {
      result[key] = input[key] as boolean;
    }
  }
  return result;
}

@Injectable()
export class BusinessesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async list(): Promise<BusinessResult[]> {
    const rows = await this.prisma.business.findMany({
      orderBy: { createdAt: 'desc' },
      include: { aiChatPlan: true },
    });
    return rows.map((row) => this.toResult(row));
  }

  // Creates the business and its first admin in a single operation (Prisma wraps
  // the nested create in an implicit transaction) — without this, a newly
  // created business would have no one to log in with. The admin doesn't receive a
  // branchId: they create their first branch themselves once logged in.
  async create(dto: CreateBusinessDto): Promise<BusinessResult> {
    const passwordHash = await this.passwordHasher.hash(dto.admin.password);
    const enabledModules = { ...DEFAULT_ENABLED_MODULES, ...pickValidModules(dto.enabled_modules) };
    // aiChat is opt-in (enabledModules.aiChat) — a business that doesn't
    // enable it gets no plan at all. One that does gets the platform default
    // automatically: there's no plan-picker in the business modal, so this is
    // the only way the feature ends up usable once the flag is on.
    const aiChatPlanId = dto.ai_chat_plan_id ?? (enabledModules.aiChat ? await this.defaultAiChatPlanId() : null);

    try {
      const business = await this.prisma.business.create({
        data: {
          name: dto.name,
          enabledModules,
          aiChatPlanId,
          profiles: {
            create: {
              email: dto.admin.email,
              passwordHash,
              fullName: dto.admin.full_name,
              role: 'admin',
            },
          },
        },
        include: { aiChatPlan: true },
      });
      // Real categories for every new business, no flag condition —
      // there's no longer a hardcoded fallback path if this fails.
      await this.categoriesService.seedDefaults(business.id);
      return this.toResult(business);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese correo');
      }
      throw error;
    }
  }

  // Partial update: is_active is overwritten directly, enabled_modules is merged with
  // what the business already had (dto.enabled_modules can arrive with only
  // some keys, e.g. when checking/unchecking a single checkbox in the modal).
  async update(id: string, dto: UpdateBusinessDto): Promise<BusinessResult> {
    const data: Prisma.BusinessUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.is_active !== undefined) data.isActive = dto.is_active;
    if (dto.ai_chat_plan_id !== undefined) data.aiChatPlan = { connect: { id: dto.ai_chat_plan_id } };

    if (dto.enabled_modules !== undefined) {
      const current = await this.prisma.business.findUniqueOrThrow({
        where: { id },
        select: { enabledModules: true, aiChatPlanId: true },
      });
      const currentModules = { ...DEFAULT_ENABLED_MODULES, ...(current.enabledModules as Partial<EnabledModules>) };
      const newModules = { ...currentModules, ...pickValidModules(dto.enabled_modules) };
      data.enabledModules = newModules;

      // Same as create(): turning aiChat on for a business that has no plan
      // yet auto-assigns the platform default, unless this same request
      // already set an explicit ai_chat_plan_id above.
      const turningAiChatOn = newModules.aiChat && !currentModules.aiChat;
      if (turningAiChatOn && !current.aiChatPlanId && dto.ai_chat_plan_id === undefined) {
        const defaultPlanId = await this.defaultAiChatPlanId();
        if (defaultPlanId) data.aiChatPlan = { connect: { id: defaultPlanId } };
      }
    }

    const business = await this.prisma.business.update({ where: { id }, data, include: { aiChatPlan: true } });
    return this.toResult(business);
  }

  // Deterministic even with more than one plan flagged is_default (a stray
  // duplicate from a seed re-run, see migration 064) — picks the oldest one,
  // never throws: a business simply gets no plan if the catalog has none.
  private async defaultAiChatPlanId(): Promise<string | null> {
    const plan = await this.prisma.aiChatPlan.findFirst({
      where: { isDefault: true, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return plan?.id ?? null;
  }

  private toResult(row: BusinessWithPlan): BusinessResult {
    const planLimits = (row.aiChatPlan?.limits as AiChatPlanLimits) ?? {};
    return {
      id: row.id,
      name: row.name,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
      enabled_modules: { ...DEFAULT_ENABLED_MODULES, ...(row.enabledModules as Partial<EnabledModules>) },
      ai_chat_plan: row.aiChatPlan
        ? {
            id: row.aiChatPlan.id,
            name: row.aiChatPlan.name,
            messages_per_day: planLimits.messages_per_day ?? null,
          }
        : null,
    };
  }
}
