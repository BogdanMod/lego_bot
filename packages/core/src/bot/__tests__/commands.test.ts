import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context, Scenes } from 'telegraf';

import {
  handleStart,
  handleCreateBot,
  handleMyBots,
  handleHelp,
  handleInstruction,
  handleSetupMiniApp,
  handleCheckWebhook,
} from '../commands';

import { getBotsByUserId } from '../../db/bots';
import { setBotMenuButton, getWebhookInfoFormatted } from '../../services/telegram-webhook';
import {
  getMainMenuWithMiniAppKeyboard,
  getBackButtonKeyboard,
  getBotsListKeyboard,
} from '../keyboards';

vi.mock('../../db/bots', () => ({
  getBotsByUserId: vi.fn(),
}));

vi.mock('../../services/telegram-webhook', () => ({
  setBotMenuButton: vi.fn(),
  getWebhookInfoFormatted: vi.fn(),
}));

vi.mock('../keyboards', () => ({
  getMainMenuWithMiniAppKeyboard: vi.fn(),
  getBackButtonKeyboard: vi.fn(),
  getBotsListKeyboard: vi.fn(),
}));

function createMockContext(overrides = {}): Partial<Context> {
  return {
    from: { id: 123, first_name: 'Test User' } as any,
    chat: { id: 777 } as any,
    message: { text: '' } as any,
    reply: vi.fn().mockResolvedValue({}),
    answerCbQuery: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function createMockSceneContext(overrides = {}): Partial<Scenes.SceneContext> {
  return {
    ...createMockContext(),
    scene: {
      enter: vi.fn().mockResolvedValue({}),
      leave: vi.fn().mockResolvedValue({}),
    } as any,
    ...overrides,
  };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  vi.clearAllMocks();
  envBackup = { ...process.env };
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

describe('handleStart', () => {
  it('should send welcome message with user name', async () => {
    process.env.MINI_APP_URL = 'https://test.app';
    (getMainMenuWithMiniAppKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'kb' });

    const ctx = createMockContext({ from: { id: 1, first_name: 'John' } as any });
    await handleStart(ctx as Context);

    expect(getMainMenuWithMiniAppKeyboard).toHaveBeenCalledWith('https://test.app');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('John'),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: { k: 'kb' },
      })
    );
  });

  it('should use default name when user name is missing', async () => {
    process.env.MINI_APP_URL = 'https://test.app';
    (getMainMenuWithMiniAppKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'kb' });

    const ctx = createMockContext({ from: { id: 1 } as any });
    await handleStart(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('<b>пользователь</b>'), expect.any(Object));
  });

  it('should use MINI_APP_URL from env', async () => {
    process.env.MINI_APP_URL = 'https://test.app';
    (getMainMenuWithMiniAppKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'kb' });

    const ctx = createMockContext();
    await handleStart(ctx as Context);

    expect(getMainMenuWithMiniAppKeyboard).toHaveBeenCalledWith('https://test.app');
  });

  it('should fallback to DEFAULT_MINI_APP_URL when MINI_APP_URL not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.MINI_APP_URL;
    process.env.DEFAULT_MINI_APP_URL = 'https://default.app';
    (getMainMenuWithMiniAppKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'kb' });

    const ctx = createMockContext();
    await handleStart(ctx as Context);

    expect(getMainMenuWithMiniAppKeyboard).toHaveBeenCalledWith('https://default.app');
  });

  it('should fallback to hardcoded URL when MINI_APP_URL and DEFAULT_MINI_APP_URL not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.MINI_APP_URL;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.DEFAULT_MINI_APP_URL;
    (getMainMenuWithMiniAppKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'kb' });

    const ctx = createMockContext();
    await handleStart(ctx as Context);

    expect(getMainMenuWithMiniAppKeyboard).toHaveBeenCalledWith('https://lego-bot-miniapp.vercel.app');
  });
});

describe('handleMyBots', () => {
  it('should return error when userId is missing', async () => {
    const ctx = createMockContext({ from: undefined });
    await handleMyBots(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Не удалось определить ваш ID пользователя'));
  });

  it('should show empty state when user has no bots', async () => {
    (getBotsByUserId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getBotsListKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'list' });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleMyBots(ctx as Context);

    expect(getBotsByUserId).toHaveBeenCalledWith(123);
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('У вас пока нет созданных ботов'),
      expect.objectContaining({
        reply_markup: { k: 'list' },
      })
    );
  });

  it('should list all user bots with details', async () => {
    const bot1 = {
      id: 'bot-1',
      name: 'Bot One',
      created_at: new Date('2026-01-01T10:00:00.000Z'),
      webhook_set: true,
    };
    const bot2 = {
      id: 'bot-2',
      name: 'Bot Two',
      created_at: new Date('2026-01-02T12:30:00.000Z'),
      webhook_set: false,
    };

    (getBotsByUserId as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([bot1, bot2]);
    (getBotsListKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'list' });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleMyBots(ctx as Context);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('Ваши боты (2)');
    expect(repliedText).toContain('Bot One');
    expect(repliedText).toContain('bot-1');
    expect(repliedText).toContain(new Date(bot1.created_at).toLocaleString('ru-RU'));
    expect(repliedText).toContain('Bot Two');
    expect(repliedText).toContain('bot-2');
    expect(repliedText).toContain(new Date(bot2.created_at).toLocaleString('ru-RU'));
  });

  it('should handle database errors gracefully', async () => {
    (getBotsByUserId as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleMyBots(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Произошла ошибка при получении списка ботов.')
    );
  });
});

describe('handleHelp', () => {
  it('should send help message with all commands', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext();
    await handleHelp(ctx as Context);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('/start');
    expect(repliedText).toContain('/help');
    expect(repliedText).toContain('/instruction');
    expect(repliedText).toContain('/setup_miniapp');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reply_markup: { k: 'back' },
      })
    );
  });
});

describe('handleInstruction', () => {
  it('should send detailed Mini App instructions', async () => {
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext();
    await handleInstruction(ctx as Context);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('Инструкция');
    expect(repliedText).toContain('Open Mini App');
    expect(repliedText).toContain('/newbot');
    expect(repliedText).toContain('https://test.app');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        reply_markup: { k: 'back' },
      })
    );
  });
});

describe('handleSetupMiniApp', () => {
  it('should return error when TELEGRAM_BOT_TOKEN not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.TELEGRAM_BOT_TOKEN;
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext();
    await handleSetupMiniApp(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('TELEGRAM_BOT_TOKEN'),
      expect.objectContaining({
        reply_markup: { k: 'back' },
      })
    );
  });

  it('should deny access when user not in ADMIN_USER_IDS', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123,456';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext({ from: { id: 999 } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Недостаточно прав'),
      expect.any(Object)
    );
  });

  it('should allow admin user to setup menu button', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (setBotMenuButton as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const ctx = createMockContext({ from: { id: 123 } as any, message: { text: '/setup_miniapp 555' } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(setBotMenuButton).toHaveBeenCalledWith('token', 'Open Mini App', 'https://test.app', 555);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Menu Button'), expect.any(Object));
  });

  it('should handle setBotMenuButton API errors', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (setBotMenuButton as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, description: 'API Error' });

    const ctx = createMockContext({ from: { id: 123 } as any, message: { text: '/setup_miniapp 555' } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('API Error'),
      expect.objectContaining({
        reply_markup: { k: 'back' },
      })
    );
  });

  it('should parse chat_id from command arguments for admin', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (setBotMenuButton as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const ctx = createMockContext({ from: { id: 123 } as any, message: { text: '/setup_miniapp 12345' } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(setBotMenuButton).toHaveBeenCalledWith('token', 'Open Mini App', 'https://test.app', 12345);
  });

  it('should return error on non-numeric chat_id argument for admin', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext({ from: { id: 123 } as any, message: { text: '/setup_miniapp abc' } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(setBotMenuButton).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Некорректный chat_id'),
      expect.objectContaining({
        reply_markup: { k: 'back' },
      })
    );
  });

  it('should handle setBotMenuButton throwing an error', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (setBotMenuButton as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const ctx = createMockContext({ from: { id: 123 } as any, message: { text: '/setup_miniapp 555' } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('boom'), expect.any(Object));
  });

  it('should handle per-chat setup when ADMIN_USER_IDS is not configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ADMIN_USER_IDS;
    process.env.MINI_APP_URL = 'https://test.app';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (setBotMenuButton as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const ctx = createMockContext({ chat: { id: 888 } as any });
    await handleSetupMiniApp(ctx as Context);

    expect(setBotMenuButton).toHaveBeenCalledWith('token', 'Open Mini App', 'https://test.app', 888);
  });
});

describe('handleCheckWebhook', () => {
  it('should show webhook info when configured', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getWebhookInfoFormatted as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      info: {
        url: 'https://example.com/webhook',
        has_custom_certificate: false,
        pending_update_count: 7,
      },
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleCheckWebhook(ctx as Context);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('https://example.com/webhook');
    expect(repliedText).toContain('7');
  });

  it('should show not configured message when webhook missing', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getWebhookInfoFormatted as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      info: {
        url: '',
        has_custom_certificate: false,
        pending_update_count: 0,
      },
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleCheckWebhook(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Webhook не настроен'), expect.any(Object));
  });

  it('should display last error if present', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getWebhookInfoFormatted as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      info: {
        url: 'https://example.com/webhook',
        has_custom_certificate: false,
        pending_update_count: 0,
        last_error_date: 1700000000,
        last_error_message: 'Bad gateway',
      },
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleCheckWebhook(ctx as Context);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('Bad gateway');
    expect(repliedText).toContain(new Date(1700000000 * 1000).toLocaleString('ru-RU'));
  });

  it('should deny access for non-admin users', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext({ from: { id: 999 } as any });
    await handleCheckWebhook(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Недостаточно прав'), expect.any(Object));
  });

  it('should return error when TELEGRAM_BOT_TOKEN not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.TELEGRAM_BOT_TOKEN;
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });

    const ctx = createMockContext();
    await handleCheckWebhook(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('TELEGRAM_BOT_TOKEN'), expect.any(Object));
  });

  it('should handle getWebhookInfoFormatted errors', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getWebhookInfoFormatted as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'Failed to get webhook info',
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleCheckWebhook(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Failed to get webhook info'), expect.any(Object));
  });

  it('should render ip_address, max_connections and allowed_updates when present', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getWebhookInfoFormatted as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      info: {
        url: 'https://example.com/webhook',
        has_custom_certificate: false,
        pending_update_count: 1,
        ip_address: '1.2.3.4',
        max_connections: 40,
        allowed_updates: ['message', 'callback_query'],
      },
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleCheckWebhook(ctx as Context);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('1.2.3.4');
    expect(repliedText).toContain('40');
    expect(repliedText).toContain('message, callback_query');
  });

  it('should handle getWebhookInfoFormatted throwing an error', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token';
    process.env.ADMIN_USER_IDS = '123';
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getWebhookInfoFormatted as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'));

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleCheckWebhook(ctx as Context);

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('boom'), expect.any(Object));
  });
});

describe('handleCreateBot', () => {
  it('should enter create_bot scene', async () => {
    const ctx = createMockSceneContext();
    await handleCreateBot(ctx as Scenes.SceneContext);

    expect((ctx as any).scene.enter).toHaveBeenCalledWith('create_bot');
  });
});