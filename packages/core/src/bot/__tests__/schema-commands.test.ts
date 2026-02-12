import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Context } from 'telegraf';

import { BOT_LIMITS } from '@dialogue-constructor/shared';
import { createMockBotSchema } from '../../../test-utils/mock-factories';

import { handleEditSchema, validateSchemaLimits } from '../schema-commands';

import { getBotById, updateBotSchema } from '../../db/bots';
import { getBackButtonKeyboard } from '../keyboards';

vi.mock('../../db/bots', () => ({
  getBotById: vi.fn(),
  updateBotSchema: vi.fn(),
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

describe('validateSchemaLimits', () => {
  it('should validate correct schema', () => {
    const schema = createMockBotSchema();
    expect(validateSchemaLimits(schema)).toEqual({ valid: true });
  });

  it('should reject non-object schema', () => {
    expect(validateSchemaLimits(null)).toEqual({
      valid: false,
      error: { error: 'Invalid schema format' },
    });
  });

  it('should reject schema with invalid version', () => {
    const schema = createMockBotSchema({ version: 2 as any });
    expect(validateSchemaLimits(schema)).toEqual({
      valid: false,
      error: { error: 'Invalid schema version. Must be 1' },
    });
  });

  it('should reject schema without states', () => {
    const schema = { version: 1, initialState: 'start' };
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid states format');
    }
  });

  it('should reject schema missing initialState', () => {
    const schema = {
      version: 1,
      states: {
        start: { message: 'Hello' },
      },
    };
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid initialState');
    }
  });

  it('should reject schema where initialState is not present in states', () => {
    const schema = {
      version: 1,
      initialState: 'start',
      states: {
        other: { message: 'Hello' },
      },
    };
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid initialState');
    }
  });

  it('should reject schema with too many states', () => {
    const states: Record<string, any> = {};
    for (let i = 0; i < BOT_LIMITS.MAX_SCHEMA_STATES + 1; i++) {
      states[`s${i}`] = { message: 'x' };
    }
    const schema = {
      version: 1,
      initialState: 's0',
      states,
    };
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Schema too large');
    }
  });

  it('should reject schema with a state key longer than BOT_LIMITS.MAX_STATE_KEY_LENGTH', () => {
    const longKey = 'a'.repeat(BOT_LIMITS.MAX_STATE_KEY_LENGTH + 1);
    const schema = {
      version: 1,
      initialState: longKey,
      states: {
        [longKey]: { message: 'Hello' },
      },
    };

    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid state key');
      expect(result.error.message).toBe(
        `State key "${longKey}" exceeds maximum length of ${BOT_LIMITS.MAX_STATE_KEY_LENGTH}`
      );
    }
  });

  it('should reject schema with a state defined as a non-object', () => {
    const schema = {
      version: 1,
      initialState: 'start',
      states: {
        start: 'not-an-object',
      },
    };

    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid state format');
      expect(result.error.message).toBe('State "start" must be an object');
    }
  });

  it('should reject state with message exceeding limit', () => {
    const schema = createMockBotSchema({
      states: {
        start: { message: 'a'.repeat(BOT_LIMITS.MAX_MESSAGE_LENGTH + 1) },
      } as any,
      initialState: 'start',
    });
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Message too long');
    }
  });

  it('should reject schema with buttons as a non-array', () => {
    const schema = {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: 'Hello', buttons: 'not-an-array' },
      },
    };

    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid state.buttons format');
      expect(result.error.message).toBe('State "start" buttons must be an array');
    }
  });

  it('should reject state with too many buttons', () => {
    const buttons = Array.from({ length: BOT_LIMITS.MAX_BUTTONS_PER_STATE + 1 }).map((_, i) => ({
      text: `B${i}`,
      nextState: 'start',
    }));
    const schema = createMockBotSchema({
      states: {
        start: { message: 'Hello', buttons },
      } as any,
      initialState: 'start',
    });
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Too many buttons');
    }
  });

  it('should reject schema with buttons array containing a non-object entry', () => {
    const schema = {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: 'Hello', buttons: ['not-an-object'] },
      },
    };

    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid button format');
      expect(result.error.message).toBe('Button in state "start" must be an object');
    }
  });

  it('should reject schema with a button where text is not a string', () => {
    const schema = {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: 'Hello', buttons: [{ text: 123, nextState: 'start' }] },
      },
    };

    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid button.text type');
      expect(result.error.message).toBe('Button text in state "start" must be a string');
    }
  });

  it('should reject schema with a button where nextState is not a string', () => {
    const schema = {
      version: 1,
      initialState: 'start',
      states: {
        start: { message: 'Hello', buttons: [{ text: 'Next', nextState: 123 }] },
      },
    };

    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid button.nextState type');
      expect(result.error.message).toBe('Button nextState in state "start" must be a string');
    }
  });

  it('should reject button with invalid nextState', () => {
    const schema = createMockBotSchema({
      states: {
        start: { message: 'Hello', buttons: [{ text: 'Next', nextState: 'missing' }] },
      } as any,
      initialState: 'start',
    });
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Invalid button.nextState');
    }
  });

  it('should reject button text exceeding limit', () => {
    const schema = createMockBotSchema({
      states: {
        start: {
          message: 'Hello',
          buttons: [{ text: 'a'.repeat(BOT_LIMITS.MAX_BUTTON_TEXT_LENGTH + 1), nextState: 'next' }],
        },
        next: { message: 'Next' },
      } as any,
      initialState: 'start',
    });
    const result = validateSchemaLimits(schema);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.error).toBe('Button text too long');
    }
  });
});

describe('handleEditSchema', () => {
  it('should return error when userId missing', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    const ctx = createMockContext({ from: undefined });

    await handleEditSchema(ctx as Context, 'bot-id', '{"version":1}');

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('Не удалось определить ваш ID пользователя'),
      expect.objectContaining({
        reply_markup: { k: 'back' },
      })
    );
  });

  it('should return usage help when botId missing', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    const ctx = createMockContext();

    await handleEditSchema(ctx as Context, undefined, undefined);

    const repliedText = (ctx.reply as any).mock.calls[0][0] as string;
    expect(repliedText).toContain('/editschema');
    expect(ctx.reply).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: { k: 'back' },
      })
    );
  });

  it('should return error when schemaJson missing', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    const ctx = createMockContext();

    await handleEditSchema(ctx as Context, 'bot-id', undefined);

    expect(ctx.reply).toHaveBeenCalledWith(
      expect.stringContaining('JSON'),
      expect.objectContaining({
        parse_mode: 'HTML',
        reply_markup: { k: 'back' },
      })
    );
  });

  it('should return error when bot not found', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleEditSchema(ctx as Context, 'bot-id', JSON.stringify(createMockBotSchema()));

    expect(getBotById).toHaveBeenCalledWith('bot-id', 123);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('не найден'), expect.any(Object));
  });

  it('should return error on invalid JSON', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'bot-id', name: 'Bot', schema_version: 0 });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleEditSchema(ctx as Context, 'bot-id', '{invalid');

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Ошибка парсинга JSON'), expect.any(Object));
  });

  it('should return error on schema validation failure', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'bot-id', name: 'Bot', schema_version: 0 });

    const invalidSchema = createMockBotSchema({ version: 2 as any });

    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleEditSchema(ctx as Context, 'bot-id', JSON.stringify(invalidSchema));

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Schema validation failed'), expect.any(Object));
  });

  it('should successfully update schema', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      name: 'My Bot',
      schema_version: 0,
    });
    (updateBotSchema as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const schema = createMockBotSchema();
    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleEditSchema(ctx as Context, 'bot-id', JSON.stringify(schema));

    expect(updateBotSchema).toHaveBeenCalledWith('bot-id', 123, schema);
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Схема успешно обновлена'), expect.any(Object));
  });

  it('should handle updateBotSchema failure', async () => {
    (getBackButtonKeyboard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ k: 'back' });
    (getBotById as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'bot-id',
      name: 'My Bot',
      schema_version: 0,
    });
    (updateBotSchema as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    const schema = createMockBotSchema();
    const ctx = createMockContext({ from: { id: 123 } as any });
    await handleEditSchema(ctx as Context, 'bot-id', JSON.stringify(schema));

    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('Не удалось обновить схему'), expect.any(Object));
  });
});