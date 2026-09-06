import { ForbiddenException } from '@nestjs/common';
import { TelegramChatIaWebhookController } from './telegram-chat-ia-webhook.controller';
import { AgentIdentityService } from '../ai-chat/agent-identity.service';
import { AiChatProxyService } from '../ai-chat/ai-chat-proxy.service';
import { TelegramSenderService } from '../telegram/telegram-sender.service';

// processMessage runs fire-and-forget after handleWebhook already returned
// (so Telegram gets its 200 immediately) — flush the microtask queue after
// each call so the async work has a chance to run before assertions.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('TelegramChatIaWebhookController', () => {
  let agentIdentityService: { getOrCreateAgentProfile: jest.Mock };
  let aiChatProxyService: { sendMessage: jest.Mock };
  let telegramSenderService: { sendMessage: jest.Mock };
  let controller: TelegramChatIaWebhookController;

  const config = {
    businessId: 'biz1',
    botToken: 'tok',
    chatId: '123',
    chatIaEnabled: true,
  };
  const profile = { id: 'agent1', email: 'agent@internal', role: 'admin', fullName: 'Agente', businessId: 'biz1' };

  const request = (body: unknown) => ({ telegramBotConfig: config }) as never;

  beforeEach(() => {
    agentIdentityService = { getOrCreateAgentProfile: jest.fn().mockResolvedValue(profile) };
    aiChatProxyService = { sendMessage: jest.fn().mockResolvedValue({ content: 'Vendiste Bs 100 ayer' }) };
    telegramSenderService = { sendMessage: jest.fn().mockResolvedValue(undefined) };

    controller = new TelegramChatIaWebhookController(
      agentIdentityService as unknown as AgentIdentityService,
      aiChatProxyService as unknown as AiChatProxyService,
      telegramSenderService as unknown as TelegramSenderService,
    );
  });

  it('ignora si chat_ia_enabled es false', async () => {
    const req = { telegramBotConfig: { ...config, chatIaEnabled: false } } as never;

    const result = await controller.handleWebhook({ message: { text: 'hola', chat: { id: 123, type: 'private' } } }, req);

    expect(result).toEqual({ ok: true });
    await flush();
    expect(aiChatProxyService.sendMessage).not.toHaveBeenCalled();
  });

  it('ignora updates sin texto', async () => {
    const result = await controller.handleWebhook({ message: { chat: { id: 123, type: 'private' } } }, request(null));

    expect(result).toEqual({ ok: true });
    await flush();
    expect(aiChatProxyService.sendMessage).not.toHaveBeenCalled();
  });

  it('ignora mensajes de un chat distinto al registrado', async () => {
    const result = await controller.handleWebhook(
      { message: { text: 'hola', chat: { id: 999, type: 'private' } } },
      request(null),
    );

    expect(result).toEqual({ ok: true });
    await flush();
    expect(aiChatProxyService.sendMessage).not.toHaveBeenCalled();
  });

  it('procesa el mensaje del chat autorizado y responde con la respuesta del orchestrator', async () => {
    const result = await controller.handleWebhook(
      { message: { text: '¿cuánto vendí ayer?', chat: { id: 123, type: 'private' } } },
      request(null),
    );

    expect(result).toEqual({ ok: true });
    await flush();

    expect(agentIdentityService.getOrCreateAgentProfile).toHaveBeenCalledWith('biz1', 'admin');
    expect(aiChatProxyService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'agent1', business_id: 'biz1', role: 'admin', branch_id: null }),
      { messages: [{ role: 'user', content: '¿cuánto vendí ayer?' }], locale: 'es' },
    );
    expect(telegramSenderService.sendMessage).toHaveBeenCalledWith('tok', '123', 'Vendiste Bs 100 ayer');
  });

  it('responde con el mensaje de la excepción si AiChatProxyService rechaza (cuota/módulo deshabilitado)', async () => {
    aiChatProxyService.sendMessage.mockRejectedValue(new ForbiddenException('El chat IA no está habilitado para este negocio.'));

    await controller.handleWebhook({ message: { text: 'hola', chat: { id: 123, type: 'private' } } }, request(null));
    await flush();

    expect(telegramSenderService.sendMessage).toHaveBeenCalledWith(
      'tok',
      '123',
      '⚠️ El chat IA no está habilitado para este negocio.',
    );
  });

  it('responde con un mensaje genérico si el error no es una HttpException', async () => {
    aiChatProxyService.sendMessage.mockRejectedValue(new Error('fetch failed'));

    await controller.handleWebhook({ message: { text: 'hola', chat: { id: 123, type: 'private' } } }, request(null));
    await flush();

    expect(telegramSenderService.sendMessage).toHaveBeenCalledWith(
      'tok',
      '123',
      expect.stringContaining('no está disponible en este momento'),
    );
  });
});
