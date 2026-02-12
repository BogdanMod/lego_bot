import express from 'express';
import type { Express } from 'express';
import type { Test } from 'supertest';
import { expect } from 'vitest';
import crypto from 'crypto';
import { getTelegramBotToken } from '@dialogue-constructor/shared';

export function createTestApp(): Express {
  const app = express();
  app.use(express.json());
  return app;
}

export function buildTelegramInitData(userId: number, botToken: string): string {
  const params = new URLSearchParams();
  params.set('auth_date', Math.floor(Date.now() / 1000).toString());
  params.set('user', JSON.stringify({ id: userId, first_name: 'Test' }));

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);

  return params.toString();
}

export function authenticateRequest(request: Test, userId = 1, botToken?: string): Test {
  const token = botToken ?? getTelegramBotToken() ?? 'test-bot-token';
  const initData = buildTelegramInitData(userId, token);
  return request.set('X-Telegram-Init-Data', initData);
}

export function expectApiError(response: { status: number; body: any }, status: number, error?: string) {
  expect(response.status).toBe(status);
  if (error) {
    expect(response.body.error).toBe(error);
  }
}

// Функции для создания mock Telegram updates
export function createTelegramMessageUpdate(options: {
  updateId: number;
  chatId: number;
  userId: number;
  text: string;
  messageId?: number;
}): object {
  const messageId = options.messageId ?? 1;
  return {
    update_id: options.updateId,
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: options.chatId, type: 'private' },
      from: { id: options.userId, is_bot: false, first_name: 'Test' },
      text: options.text,
    },
  };
}

export function createTelegramCallbackQueryUpdate(options: {
  updateId: number;
  chatId: number;
  userId: number;
  data: string;
  messageId?: number;
}): object {
  const messageId = options.messageId ?? 1;
  return {
    update_id: options.updateId,
    callback_query: {
      id: `cq_${options.updateId}`,
      from: { id: options.userId, is_bot: false, first_name: 'Test' },
      message: {
        message_id: messageId,
        date: Math.floor(Date.now() / 1000),
        chat: { id: options.chatId, type: 'private' },
        text: 'Button',
      },
      chat_instance: 'ci_1',
      data: options.data,
    },
  };
}

export function createTelegramContactUpdate(options: {
  updateId: number;
  chatId: number;
  userId: number;
  phoneNumber: string;
  firstName: string;
}): object {
  return {
    update_id: options.updateId,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: options.chatId, type: 'private' },
      from: { id: options.userId, is_bot: false, first_name: options.firstName },
      contact: {
        phone_number: options.phoneNumber,
        first_name: options.firstName,
        user_id: options.userId,
      },
    },
  };
}
