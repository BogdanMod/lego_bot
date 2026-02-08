import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Context as TelegrafContext } from 'telegraf';

import type { BotWizardContext } from '../scenes';
import { createBotScene } from '../scenes';

import { createBot, botExistsByToken, updateWebhookStatus } from '../../db/bots';
import { getCancelButtonKeyboard, getMainMenuKeyboard } from '../keyboards';
import { encryptToken } from '../../utils/encryption';
import { setWebhook } from '../../services/telegram-webhook';

vi.mock('../../db/bots', () => ({
  createBot: vi.fn(),
  botExistsByToken: vi.fn(),
  updateWebhookStatus: vi.fn(),
}));

vi.mock('../keyboards', () => ({
  getCancelButtonKeyboard: vi.fn(),
  getMainMenuKeyboard: vi.fn(),
}));

vi.mock('../../utils/encryption', () => ({
  encryptToken: vi.fn(),
}));

vi.mock('../../services/telegram-webhook', () => ({
  setWebhook: vi.fn(),
}));

function createMockWizardContext(overrides: any = {}): Partial<BotWizardContext> {
  return {
    from: { id: 123, first_name: 'Test' } as any,
    message: { text: '' } as any,
    reply: vi.fn().mockResolvedValue({}),
    answerCbQuery: vi.fn().mockResolvedValue(true),
    scene: {
      session: {
        botCreation: { step: null },
        cursor: 0,
      },
      enter: vi.fn(),
      leave: vi.fn().mockResolvedValue({}),
    } as any,
    wizard: {
      next: vi.fn(),
    } as any,
    ...overrides,
  };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  vi.clearAllMocks();
  envBackup = { ...process.env };
  process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';
  (getCancelButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'cancel' });
  (getMainMenuKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'menu' });
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in envBackup)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete process.env[key];
    }
  }
  Object.assign(process.env, envBackup);
  vi.restoreAllMocks();
});

describe('createBotScene - Step 1 (instruction)', () => {
  it('should send instruction with HTML, show cancel button, init session and call wizard.next', async () => {
    const ctx = createMockWizardContext({
      scene: { session: { botCreation: undefined, cursor: undefined }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[0] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('<b>'),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: { k: 'cancel' },
      })
    );
    expect((ctx as any).scene.session.botCreation).toBeDefined();
    expect((ctx as any).scene.session.botCreation.step).toBe('waiting_for_token');
    expect((ctx as any).scene.session.cursor).toBe(0);
    expect((ctx as any).wizard.next).toHaveBeenCalled();
  });
});

describe('createBotScene - Step 2 (token)', () => {
  it('should accept valid token', async () => {
    const ctx = createMockWizardContext({
      message: { text: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_token' }, cursor: 1 }, leave: vi.fn() } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('encrypted');
    (botExistsByToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await (createBotScene.steps[1] as any)(ctx as any);

    expect(botExistsByToken).toHaveBeenCalledWith('encrypted');
    expect((ctx as any).scene.session.botCreation.token).toBe('123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    expect((ctx as any).scene.session.botCreation.step).toBe('waiting_for_name');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Токен принят'),
      expect.objectContaining({ reply_markup: { k: 'cancel' } })
    );
    expect((ctx as any).wizard.next).toHaveBeenCalled();
  });

  it('should reject invalid token format', async () => {
    const ctx = createMockWizardContext({
      message: { text: 'invalid-token' } as any,
    });

    await (createBotScene.steps[1] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Неверный формат токена'),
      expect.any(Object)
    );
    expect((ctx as any).wizard.next).not.toHaveBeenCalled();
  });

  it('should reject empty message', async () => {
    const ctx = createMockWizardContext({
      message: { text: '   ' } as any,
    });

    await (createBotScene.steps[1] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('не может быть пустым'));
    expect((ctx as any).wizard.next).not.toHaveBeenCalled();
  });

  it('should reject non-text message', async () => {
    const ctx = createMockWizardContext({
      message: { photo: [] } as any,
    });

    await (createBotScene.steps[1] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('текстовое сообщение'));
    expect((ctx as any).wizard.next).not.toHaveBeenCalled();
  });

  it('should reject already registered token', async () => {
    const ctx = createMockWizardContext({
      message: { text: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_token' }, cursor: 1 }, leave: vi.fn() } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('encrypted');
    (botExistsByToken as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await (createBotScene.steps[1] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('уже зарегистрирован'));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
    expect((ctx as any).wizard.next).not.toHaveBeenCalled();
  });

  it('should handle error when ENCRYPTION_KEY not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ENCRYPTION_KEY;
    const ctx = createMockWizardContext({
      message: { text: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_token' }, cursor: 1 }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[1] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ENCRYPTION_KEY'));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
    expect(encryptToken).not.toHaveBeenCalled();
    expect(botExistsByToken).not.toHaveBeenCalled();
    expect((ctx as any).wizard.next).not.toHaveBeenCalled();
  });

  it('should continue when token check throws an error', async () => {
    const ctx = createMockWizardContext({
      message: { text: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_token' }, cursor: 1 }, leave: vi.fn() } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('encrypt failed');
    });

    await (createBotScene.steps[1] as any)(ctx as any);

    expect((ctx as any).scene.session.botCreation.token).toBe('123456789:ABCdefGHIjklMNOpqrsTUVwxyz');
    expect((ctx as any).scene.session.botCreation.step).toBe('waiting_for_name');
    expect((ctx as any).wizard.next).toHaveBeenCalled();
  });
});

describe('createBotScene - Step 3 (name & create)', () => {
  it('should accept valid name and create bot with encrypted token', async () => {
    process.env.ROUTER_URL = 'https://router.example.com';

    const ctx = createMockWizardContext({
      message: { text: 'My Bot' } as any,
      scene: {
        session: { botCreation: { step: 'waiting_for_name', token: '123:ABC', name: undefined }, cursor: 2 },
        leave: vi.fn().mockResolvedValue({}),
      } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('encrypted-token');
    (createBot as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted-token',
      name: 'My Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    (setWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (updateWebhookStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(encryptToken).toHaveBeenCalledWith('123:ABC', 'test_encryption_key_32_chars_long');
    expect(createBot).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 123,
        token: 'encrypted-token',
        name: 'My Bot',
      })
    );
    expect(setWebhook).toHaveBeenCalledWith(
      '123:ABC',
      'https://router.example.com/webhook/bot-id',
      'secret',
      ['message', 'callback_query']
    );
    expect(updateWebhookStatus).toHaveBeenCalledWith('bot-id', 123, true);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('bot-id'),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: { k: 'menu' },
      })
    );
    expect((ctx as any).scene.leave).toHaveBeenCalled();
  });

  it('should reject empty name', async () => {
    const ctx = createMockWizardContext({
      message: { text: '   ' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('не может быть пустым'));
    expect(createBot).not.toHaveBeenCalled();
  });

  it('should reject name longer than 100 chars', async () => {
    const ctx = createMockWizardContext({
      message: { text: 'a'.repeat(101) } as any,
      scene: { session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('100'));
    expect(createBot).not.toHaveBeenCalled();
  });

  it('should reject non-text message', async () => {
    const ctx = createMockWizardContext({
      message: { sticker: {} } as any,
      scene: { session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('название бота текстом'));
    expect(createBot).not.toHaveBeenCalled();
  });

  it('should handle webhook API errors without interrupting creation', async () => {
    process.env.WEBHOOK_URL = 'https://wh.example.com';
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ROUTER_URL;

    const ctx = createMockWizardContext({
      message: { text: 'My Bot' } as any,
      scene: {
        session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 },
        leave: vi.fn().mockResolvedValue({}),
      } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('encrypted-token');
    (createBot as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted-token',
      name: 'My Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    (setWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, description: 'Error' });

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(setWebhook).toHaveBeenCalledWith(
      '123:ABC',
      'https://wh.example.com/webhook/bot-id',
      'secret',
      ['message', 'callback_query']
    );
    expect(updateWebhookStatus).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Бот успешно создан'), expect.any(Object));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
  });

  it('should handle setWebhook throwing an error without interrupting creation', async () => {
    process.env.WEBHOOK_URL = 'https://wh.example.com';
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ROUTER_URL;

    const ctx = createMockWizardContext({
      message: { text: 'My Bot' } as any,
      scene: {
        session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 },
        leave: vi.fn().mockResolvedValue({}),
      } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('encrypted-token');
    (createBot as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted-token',
      name: 'My Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date('2026-01-01T00:00:00.000Z'),
      updated_at: new Date('2026-01-01T00:00:00.000Z'),
    });
    (setWebhook as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(updateWebhookStatus).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Бот успешно создан'), expect.any(Object));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
  });

  it('should handle error when userId missing', async () => {
    const ctx = createMockWizardContext({
      from: undefined,
      message: { text: 'My Bot' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ваш ID'));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
  });

  it('should handle error when ENCRYPTION_KEY not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ENCRYPTION_KEY;
    const ctx = createMockWizardContext({
      message: { text: 'My Bot' } as any,
      scene: { session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 }, leave: vi.fn() } as any,
    });

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ENCRYPTION_KEY'));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
    expect(createBot).not.toHaveBeenCalled();
  });

  it('should handle createBot error', async () => {
    const ctx = createMockWizardContext({
      message: { text: 'My Bot' } as any,
      scene: {
        session: { botCreation: { step: 'waiting_for_name', token: '123:ABC' }, cursor: 2 },
        leave: vi.fn().mockResolvedValue({}),
      } as any,
    });

    (encryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('encrypted-token');
    (createBot as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    await (createBotScene.steps[2] as any)(ctx as any);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ошибка при создании бота'));
    expect((ctx as any).scene.leave).toHaveBeenCalled();
  });
});

describe("createBotScene - Action handler 'cancel_action'", () => {
  it('should answer callback query, send cancel message, show main menu and leave scene', async () => {
    const update = {
      callback_query: {
        id: '1',
        data: 'cancel_action',
        from: { id: 123 } as any,
        message: { message_id: 1, chat: { id: 1, type: 'private' } } as any,
      },
    };

    const ctx: any = new TelegrafContext(update as any, {} as any, {} as any);
    ctx.answerCbQuery = vi.fn().mockResolvedValue(true);
    ctx.reply = vi.fn().mockResolvedValue({});
    ctx.scene = { session: { botCreation: { step: 'waiting_for_token' }, cursor: 0 }, leave: vi.fn().mockResolvedValue({}) };

    const mw = (createBotScene as any).middleware();
    await mw(ctx as any, async () => {});

    expect(ctx.answerCbQuery).toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('отменено'),
      expect.objectContaining({ reply_markup: { k: 'menu' } })
    );
    expect((ctx as any).scene.leave).toHaveBeenCalled();
  });
});