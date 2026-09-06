import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { TelegramChatIaWebhookGuard } from './telegram-chat-ia-webhook.guard';
import { PrismaService } from '../prisma/prisma.service';

function makeContext(params: Record<string, string>, headers: Record<string, string>): ExecutionContext {
  const request: Record<string, unknown> = { params, headers };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('TelegramChatIaWebhookGuard', () => {
  let prisma: { telegramBotConfig: { findUnique: jest.Mock } };
  let guard: TelegramChatIaWebhookGuard;

  beforeEach(() => {
    prisma = { telegramBotConfig: { findUnique: jest.fn() } };
    guard = new TelegramChatIaWebhookGuard(prisma as unknown as PrismaService);
  });

  it('rechaza si el webhookToken no resuelve ninguna config', async () => {
    prisma.telegramBotConfig.findUnique.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeContext({ webhookToken: 'nope' }, {})),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza si el secret header no coincide', async () => {
    prisma.telegramBotConfig.findUnique.mockResolvedValue({ webhookSecret: 'shh' });

    await expect(
      guard.canActivate(makeContext({ webhookToken: 'tok' }, { 'x-telegram-bot-api-secret-token': 'wrong' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('permite el paso y adjunta la config al request si el secret coincide', async () => {
    const config = { webhookSecret: 'shh', businessId: 'biz1' };
    prisma.telegramBotConfig.findUnique.mockResolvedValue(config);
    const request: Record<string, unknown> = {
      params: { webhookToken: 'tok' },
      headers: { 'x-telegram-bot-api-secret-token': 'shh' },
    };
    const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.telegramBotConfig).toBe(config);
  });
});
