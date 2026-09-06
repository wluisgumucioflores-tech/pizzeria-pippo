import { TelegramWebhookController } from './telegram-webhook.controller';
import { SettingsService } from '../settings/settings.service';
import { TelegramChatsService } from './telegram-chats.service';
import { TelegramQuotaService } from './telegram-quota.service';
import { TelegramAiService } from './telegram-ai.service';
import { TelegramSenderService } from './telegram-sender.service';
import type { TelegramUpdatePayload } from './types/telegram-update-payload.types';

describe('TelegramWebhookController', () => {
  let settingsService: { getRawSettingsForFirstBusiness: jest.Mock; getFirstBusinessBotToken: jest.Mock };
  let telegramChatsService: { findByChatId: jest.Mock };
  let telegramQuotaService: { checkAndIncrement: jest.Mock };
  let telegramAiService: { processMessage: jest.Mock };
  let telegramSenderService: { sendMessage: jest.Mock; sendDocument: jest.Mock };
  let controller: TelegramWebhookController;

  const textUpdate = (text: string, chatId = 1, type = 'private'): TelegramUpdatePayload => ({
    message: { text, chat: { id: chatId, type } },
  });

  beforeEach(() => {
    settingsService = {
      getRawSettingsForFirstBusiness: jest.fn(),
      getFirstBusinessBotToken: jest.fn().mockResolvedValue('tok'),
    };
    telegramChatsService = { findByChatId: jest.fn() };
    telegramQuotaService = { checkAndIncrement: jest.fn() };
    telegramAiService = { processMessage: jest.fn() };
    telegramSenderService = { sendMessage: jest.fn(), sendDocument: jest.fn() };

    controller = new TelegramWebhookController(
      settingsService as unknown as SettingsService,
      telegramChatsService as unknown as TelegramChatsService,
      telegramQuotaService as unknown as TelegramQuotaService,
      telegramAiService as unknown as TelegramAiService,
      telegramSenderService as unknown as TelegramSenderService,
    );
  });

  it('ignora silenciosamente si el bot está deshabilitado', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'false' });

    const result = await controller.handleWebhook(textUpdate('hola'));

    expect(result).toEqual({ ok: true });
    expect(telegramChatsService.findByChatId).not.toHaveBeenCalled();
  });

  it('ignora updates sin texto (stickers, fotos, etc.)', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });

    const result = await controller.handleWebhook({ message: { chat: { id: 1, type: 'private' } } });

    expect(result).toEqual({ ok: true });
    expect(telegramChatsService.findByChatId).not.toHaveBeenCalled();
  });

  it('ignora chats no autorizados', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue(null);

    const result = await controller.handleWebhook(textUpdate('hola'));

    expect(result).toEqual({ ok: true });
    expect(telegramQuotaService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('ignora chats desactivados', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: false, plan: 'basic', type: 'personal' });

    const result = await controller.handleWebhook(textUpdate('hola'));

    expect(result).toEqual({ ok: true });
    expect(telegramQuotaService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('ignora mensajes de grupo si el chat autorizado no es de tipo group', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: true, plan: 'basic', type: 'personal' });

    const result = await controller.handleWebhook(textUpdate('hola', 1, 'group'));

    expect(result).toEqual({ ok: true });
    expect(telegramQuotaService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('ignora si no hay bot token configurado', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    settingsService.getFirstBusinessBotToken.mockResolvedValue('');
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: true, plan: 'basic', type: 'personal' });

    const result = await controller.handleWebhook(textUpdate('hola'));

    expect(result).toEqual({ ok: true });
    expect(telegramQuotaService.checkAndIncrement).not.toHaveBeenCalled();
  });

  it('avisa por Telegram cuando se alcanza la cuota, sin llamar a la IA', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: true, plan: 'pro', type: 'personal' });
    telegramQuotaService.checkAndIncrement.mockResolvedValue({ allowed: false, limit: 50, used: 50 });

    const result = await controller.handleWebhook(textUpdate('hola'));

    expect(telegramAiService.processMessage).not.toHaveBeenCalled();
    expect(telegramSenderService.sendMessage).toHaveBeenCalledWith(
      'tok',
      '1',
      expect.stringContaining('límite de 50 mensajes por día del plan Pro'),
    );
    expect(result).toEqual({ ok: true });
  });

  it('procesa el mensaje con la IA y responde con texto', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: true, plan: 'basic', type: 'personal' });
    telegramQuotaService.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 10, used: 1 });
    telegramAiService.processMessage.mockResolvedValue({ type: 'text', content: '💰 Ventas de hoy: Bs 100' });

    await controller.handleWebhook(textUpdate('¿cuánto vendí hoy?'));

    expect(telegramAiService.processMessage).toHaveBeenCalledWith('¿cuánto vendí hoy?');
    expect(telegramSenderService.sendMessage).toHaveBeenCalledWith('tok', '1', '💰 Ventas de hoy: Bs 100');
    expect(telegramSenderService.sendDocument).not.toHaveBeenCalled();
  });

  it('responde con documento cuando la IA devuelve un archivo', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: true, plan: 'basic', type: 'personal' });
    telegramQuotaService.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 10, used: 1 });
    const buffer = Buffer.from('excel');
    telegramAiService.processMessage.mockResolvedValue({ type: 'file', content: buffer, filename: 'ventas.xlsx' });

    await controller.handleWebhook(textUpdate('dame el excel de ventas'));

    expect(telegramSenderService.sendDocument).toHaveBeenCalledWith('tok', '1', buffer, 'ventas.xlsx');
    expect(telegramSenderService.sendMessage).not.toHaveBeenCalled();
  });

  it('permite mensajes de grupo cuando el chat autorizado sí es de tipo group', async () => {
    settingsService.getRawSettingsForFirstBusiness.mockResolvedValue({ telegram_ai_enabled: 'true' });
    telegramChatsService.findByChatId.mockResolvedValue({ isActive: true, plan: 'basic', type: 'group' });
    telegramQuotaService.checkAndIncrement.mockResolvedValue({ allowed: true, limit: 10, used: 1 });
    telegramAiService.processMessage.mockResolvedValue({ type: 'text', content: 'ok' });

    const result = await controller.handleWebhook(textUpdate('hola', 1, 'supergroup'));

    expect(telegramAiService.processMessage).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });
});
