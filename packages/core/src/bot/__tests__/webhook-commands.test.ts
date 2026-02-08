import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from 'telegraf';
import crypto from 'crypto';

import { handleSetWebhook, handleDeleteWebhook } from '../webhook-commands';

import { getBotById, setBotWebhookSecret, updateWebhookStatus } from '../../db/bots';
import { decryptToken } from '../../utils/encryption';
import { setWebhook, deleteWebhook } from '../../services/telegram-webhook';
import { getBackButtonKeyboard } from '../keyboards';

vi.mock('../../db/bots', () => ({
  getBotById: vi.fn(),
  setBotWebhookSecret: vi.fn(),
  updateWebhookStatus: vi.fn(),
}));

vi.mock('../../utils/encryption', () => ({
  decryptToken: vi.fn(),
}));

vi.mock('../../services/telegram-webhook', () => ({
  setWebhook: vi.fn(),
  deleteWebhook: vi.fn(),
}));

vi.mock('../keyboards', () => ({
  getBackButtonKeyboard: vi.fn(),
}));

function createMockContext(overrides = {}): Partial<Context> {
  return {
    from: { id: 123, first_name: 'Test User' } as any,
    reply: vi.fn().mockResolvedValue({}),
    answerCbQuery: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
}

let envBackup: NodeJS.ProcessEnv;

beforeEach(() => {
  vi.clearAllMocks();
  envBackup = { ...process.env };
  process.env.ENCRYPTION_KEY = 'test_encryption_key_32_chars_long';
  (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
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

describe('handleSetWebhook', () => {
  it('should return error when userId missing', async () => {
    const ctx = createMockContext({ from: undefined });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось определить ваш ID пользователя'),
      expect.any(Object)
    );
  });

  it('should return usage help when botId missing', async () => {
    const ctx = createMockContext();
    await handleSetWebhook(ctx as Context, undefined);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('/setwebhook');
  });

  it('should return error when bot not found', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Бот не найден'), expect.any(Object));
  });

  it('should return error when ENCRYPTION_KEY not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ENCRYPTION_KEY;
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ENCRYPTION_KEY'), expect.any(Object));
  });

  it('should handle decryption errors', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('decrypt failed');
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось расшифровать токен бота'),
      expect.any(Object)
    );
  });

  it('should generate webhook secret if missing', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: false,
      webhook_secret: null,
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('decrypted');
    (setBotWebhookSecret as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    vi.spyOn(crypto, 'randomBytes').mockImplementation(() => Buffer.from('a'.repeat(64)));
    (setWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (updateWebhookStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(setBotWebhookSecret).toHaveBeenCalled();
    expect(setWebhook).toHaveBeenCalled();
  });

  it('should successfully set webhook', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('decrypted');
    (setWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (updateWebhookStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(updateWebhookStatus).toHaveBeenCalledWith('bot-id', 123, true);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Webhook'), expect.any(Object));
  });

  it('should handle setWebhook API errors', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: false,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('decrypted');
    (setWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, description: 'Error' });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleSetWebhook(ctx as Context, 'bot-id');

    expect(updateWebhookStatus).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(Object));
  });
});

describe('handleDeleteWebhook', () => {
  it('should return error when userId missing', async () => {
    const ctx = createMockContext({ from: undefined });
    await handleDeleteWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось определить ваш ID пользователя'),
      expect.any(Object)
    );
  });

  it('should return usage help when botId missing', async () => {
    const ctx = createMockContext();
    await handleDeleteWebhook(ctx as Context, undefined);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('/deletewebhook');
  });

  it('should return error when bot not found', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleDeleteWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('не найден'), expect.any(Object));
  });

  it('should return error when ENCRYPTION_KEY not set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete process.env.ENCRYPTION_KEY;
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: true,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleDeleteWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('ENCRYPTION_KEY'), expect.any(Object));
  });

  it('should handle decryption errors', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: true,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('decrypt failed');
    });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleDeleteWebhook(ctx as Context, 'bot-id');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось расшифровать токен бота'),
      expect.any(Object)
    );
  });

  it('should successfully delete webhook', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: true,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('decrypted');
    (deleteWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (updateWebhookStatus as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleDeleteWebhook(ctx as Context, 'bot-id');

    expect(updateWebhookStatus).toHaveBeenCalledWith('bot-id', 123, false);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Webhook'), expect.any(Object));
  });

  it('should handle deleteWebhook API errors', async () => {
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      user_id: 123,
      token: 'encrypted',
      name: 'Bot',
      webhook_set: true,
      webhook_secret: 'secret',
      schema: null,
      schema_version: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });
    (decryptToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('decrypted');
    (deleteWebhook as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, description: 'Error' });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleDeleteWebhook(ctx as Context, 'bot-id');

    expect(updateWebhookStatus).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Error'), expect.any(Object));
  });
});
