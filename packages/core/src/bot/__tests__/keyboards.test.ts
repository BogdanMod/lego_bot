import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  getMainMenuKeyboard,
  getBackButtonKeyboard,
  getCancelButtonKeyboard,
  getBotsListKeyboard,
  getMiniAppKeyboard,
  getMainMenuWithMiniAppKeyboard,
} from '../keyboards';
import * as keyboards from '../keyboards';

describe('keyboards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getMainMenuKeyboard', () => {
    it('should return correct structure with 2 rows', () => {
      const result = getMainMenuKeyboard();
      expect(result).toHaveProperty('inline_keyboard');
      expect(result.inline_keyboard).toHaveLength(2);
    });

    it('should contain buttons "Создать бота", "Мои боты", "Помощь"', () => {
      const result = getMainMenuKeyboard();
      const texts = result.inline_keyboard.flat().map((b: any) => b.text as string);
      expect(texts.some((t) => t.includes('Создать бота'))).toBe(true);
      expect(texts.some((t) => t.includes('Мои боты'))).toBe(true);
      expect(texts.some((t) => t.includes('Помощь'))).toBe(true);
    });

    it('should return InlineKeyboardMarkup with correct callback_data', () => {
      const result = getMainMenuKeyboard();
      const buttons = result.inline_keyboard.flat() as any[];

      const create = buttons.find((b) => (b.text as string).includes('Создать бота'));
      const myBots = buttons.find((b) => (b.text as string).includes('Мои боты'));
      const help = buttons.find((b) => (b.text as string).includes('Помощь'));

      expect(create?.callback_data).toBe('create_bot');
      expect(myBots?.callback_data).toBe('my_bots');
      expect(help?.callback_data).toBe('help');
    });
  });

  describe('getBackButtonKeyboard', () => {
    it('should return one "Назад" button with callback_data back_to_menu', () => {
      const result = getBackButtonKeyboard();
      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toHaveLength(1);
      expect((result.inline_keyboard[0][0] as any).text).toContain('Назад');
      expect((result.inline_keyboard[0][0] as any).callback_data).toBe('back_to_menu');
    });
  });

  describe('getCancelButtonKeyboard', () => {
    it('should return "Отмена" button with callback_data cancel_action', () => {
      const result = getCancelButtonKeyboard();
      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toHaveLength(1);
      expect((result.inline_keyboard[0][0] as any).text).toContain('Отмена');
      expect((result.inline_keyboard[0][0] as any).callback_data).toBe('cancel_action');
    });
  });

  describe('getBotsListKeyboard', () => {
    it('should return buttons "Создать бота" and "Назад" in one row', () => {
      const result = getBotsListKeyboard();
      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toHaveLength(2);

      const texts = (result.inline_keyboard[0] as any[]).map((b) => b.text as string);
      expect(texts.some((t) => t.includes('Создать бота'))).toBe(true);
      expect(texts.some((t) => t.includes('Назад'))).toBe(true);
    });
  });

  describe('getMiniAppKeyboard', () => {
    it('should create web_app button with provided URL', () => {
      const result = getMiniAppKeyboard('https://example.com/app');
      expect(result.inline_keyboard).toHaveLength(1);
      expect(result.inline_keyboard[0]).toHaveLength(1);
      expect((result.inline_keyboard[0][0] as any).web_app).toEqual({ url: 'https://example.com/app' });
    });

    it('should handle different URL formats', () => {
      expect((getMiniAppKeyboard('http://localhost:3000') as any).inline_keyboard[0][0].web_app.url).toBe(
        'http://localhost:3000'
      );
      expect((getMiniAppKeyboard('tg://resolve?domain=test') as any).inline_keyboard[0][0].web_app.url).toBe(
        'tg://resolve?domain=test'
      );
    });
  });

  describe('getMainMenuWithMiniAppKeyboard', () => {
    it('should insert Mini App row between first and second rows', () => {
      const result = getMainMenuWithMiniAppKeyboard('https://example.com/app');
      expect(result.inline_keyboard.length).toBeGreaterThanOrEqual(3);
      expect((result.inline_keyboard[1][0] as any).web_app).toEqual({ url: 'https://example.com/app' });
    });

    it('should preserve all buttons from getMainMenuKeyboard()', () => {
      const result = getMainMenuWithMiniAppKeyboard('https://example.com/app');
      const texts = result.inline_keyboard.flat().map((b: any) => b.text as string);
      expect(texts.some((t) => t.includes('Создать бота'))).toBe(true);
      expect(texts.some((t) => t.includes('Мои боты'))).toBe(true);
      expect(texts.some((t) => t.includes('Помощь'))).toBe(true);
    });

    it('should work with empty menu', () => {
      const result = keyboards.getMainMenuWithMiniAppKeyboard('https://example.com/app');
      expect(result.inline_keyboard).toHaveLength(1);
      expect((result.inline_keyboard[0][0] as any).web_app).toEqual({ url: 'https://example.com/app' });
    });
  });
});
