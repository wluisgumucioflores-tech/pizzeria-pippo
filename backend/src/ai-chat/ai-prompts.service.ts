import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_LOCALE = 'es';

@Injectable()
export class AiPromptsService {
  constructor(private readonly prisma: PrismaService) {}

  // Fetches the current prompt for the requested locale, falling back to Spanish if
  // there's none loaded for that locale. No cache: it's a lightweight query, so
  // an UPDATE on the table is reflected on the next chat turn, without
  // restarting the orchestrator service.
  async getSystemPrompt(locale: string): Promise<{ locale: string; content: string }> {
    const prompt =
      (await this.prisma.aiPrompt.findUnique({ where: { locale } })) ??
      (await this.prisma.aiPrompt.findUnique({ where: { locale: DEFAULT_LOCALE } }));

    if (!prompt) {
      throw new NotFoundException(
        `No hay system prompt configurado (ni para "${locale}" ni el default "${DEFAULT_LOCALE}") en la tabla ai_prompts.`,
      );
    }
    return { locale: prompt.locale, content: prompt.content };
  }
}
