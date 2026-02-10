import { sanitizeHtml } from '../utils/sanitize.js';
import type { Logger } from '../logger.js';

const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';

const escapeMarkdownV2 = (text: string) =>
  text.replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');

type TelegramApiResponse = {
  ok?: boolean;
  description?: string;
  result?: {
    message_id?: number;
  };
};

const normalizeText = (text: string, parseMode: 'HTML' | 'Markdown' | 'MarkdownV2') => {
  if (parseMode === 'HTML') {
    return sanitizeHtml(text);
  }
  if (parseMode === 'MarkdownV2') {
    return escapeMarkdownV2(text);
  }
  return text;
};

async function postTelegram(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
  timeoutMs = 10000
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${TELEGRAM_API_BASE_URL}${botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = (await response.json()) as TelegramApiResponse;
    if (!response.ok || !data?.ok) {
      const description = data?.description || response.statusText;
      throw new Error(`Telegram API error: ${description}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendTelegramMessage(
  logger: Logger,
  botToken: string,
  chatId: number,
  text: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<number | undefined> {
  const startTime = Date.now();
  const sanitizedText = normalizeText(text, parseMode);
  try {
    const data = await postTelegram(botToken, 'sendMessage', {
      chat_id: chatId,
      text: sanitizedText,
      parse_mode: parseMode,
    });
    const messageId = data?.result?.message_id;
    logger.info(
      { chatId, messageId, duration: Date.now() - startTime },
      'Telegram message sent'
    );
    return messageId;
  } catch (error) {
    logger.error(
      { chatId, error: error instanceof Error ? error.message : String(error) },
      'Telegram API error'
    );
    throw error;
  }
}

export async function sendPhoto(
  logger: Logger,
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption?: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<number | undefined> {
  const startTime = Date.now();
  const sanitizedCaption = caption ? normalizeText(caption, parseMode) : undefined;
  try {
    const data = await postTelegram(botToken, 'sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption: sanitizedCaption,
      parse_mode: caption ? parseMode : undefined,
    });
    const messageId = data?.result?.message_id;
    logger.info(
      { chatId, messageId, duration: Date.now() - startTime },
      'Telegram photo sent'
    );
    return messageId;
  } catch (error) {
    logger.error(
      { chatId, error: error instanceof Error ? error.message : String(error) },
      'Telegram API error'
    );
    throw error;
  }
}

export async function sendVideo(
  logger: Logger,
  botToken: string,
  chatId: number,
  videoUrl: string,
  caption?: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
  cover?: string,
  thumbnail?: string
): Promise<number | undefined> {
  const startTime = Date.now();
  const sanitizedCaption = caption ? normalizeText(caption, parseMode) : undefined;
  const thumbnailToSend = thumbnail && thumbnail.startsWith('attach://') ? thumbnail : undefined;
  try {
    const data = await postTelegram(botToken, 'sendVideo', {
      chat_id: chatId,
      video: videoUrl,
      caption: sanitizedCaption,
      parse_mode: caption ? parseMode : undefined,
      cover,
      ...(thumbnailToSend ? { thumbnail: thumbnailToSend } : {}),
    });
    const messageId = data?.result?.message_id;
    logger.info(
      { chatId, messageId, duration: Date.now() - startTime },
      'Telegram video sent'
    );
    return messageId;
  } catch (error) {
    logger.error(
      { chatId, error: error instanceof Error ? error.message : String(error) },
      'Telegram API error'
    );
    throw error;
  }
}

export async function sendDocument(
  logger: Logger,
  botToken: string,
  chatId: number,
  documentUrl: string,
  caption?: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<number | undefined> {
  const startTime = Date.now();
  const sanitizedCaption = caption ? normalizeText(caption, parseMode) : undefined;
  try {
    const data = await postTelegram(botToken, 'sendDocument', {
      chat_id: chatId,
      document: documentUrl,
      caption: sanitizedCaption,
      parse_mode: caption ? parseMode : undefined,
    });
    const messageId = data?.result?.message_id;
    logger.info(
      { chatId, messageId, duration: Date.now() - startTime },
      'Telegram document sent'
    );
    return messageId;
  } catch (error) {
    logger.error(
      { chatId, error: error instanceof Error ? error.message : String(error) },
      'Telegram API error'
    );
    throw error;
  }
}

export async function sendAudio(
  logger: Logger,
  botToken: string,
  chatId: number,
  audioUrl: string,
  caption?: string,
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<number | undefined> {
  const startTime = Date.now();
  const sanitizedCaption = caption ? normalizeText(caption, parseMode) : undefined;
  try {
    const data = await postTelegram(botToken, 'sendAudio', {
      chat_id: chatId,
      audio: audioUrl,
      caption: sanitizedCaption,
      parse_mode: caption ? parseMode : undefined,
    });
    const messageId = data?.result?.message_id;
    logger.info(
      { chatId, messageId, duration: Date.now() - startTime },
      'Telegram audio sent'
    );
    return messageId;
  } catch (error) {
    logger.error(
      { chatId, error: error instanceof Error ? error.message : String(error) },
      'Telegram API error'
    );
    throw error;
  }
}
