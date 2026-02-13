"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegramMessage = sendTelegramMessage;
exports.sendPhoto = sendPhoto;
exports.sendVideo = sendVideo;
exports.sendDocument = sendDocument;
exports.sendAudio = sendAudio;
const sanitize_js_1 = require("../utils/sanitize.js");
const TELEGRAM_API_BASE_URL = 'https://api.telegram.org/bot';
const escapeMarkdownV2 = (text) => text.replace(/([\\_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
const normalizeText = (text, parseMode) => {
    if (parseMode === 'HTML') {
        return (0, sanitize_js_1.sanitizeHtml)(text);
    }
    if (parseMode === 'MarkdownV2') {
        return escapeMarkdownV2(text);
    }
    return text;
};
async function postTelegram(botToken, method, payload, timeoutMs = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${TELEGRAM_API_BASE_URL}${botToken}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        const data = (await response.json());
        if (!response.ok || !data?.ok) {
            const description = data?.description || response.statusText;
            throw new Error(`Telegram API error: ${description}`);
        }
        return data;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
async function sendTelegramMessage(logger, botToken, chatId, text, parseMode = 'HTML') {
    const startTime = Date.now();
    const sanitizedText = normalizeText(text, parseMode);
    try {
        const data = await postTelegram(botToken, 'sendMessage', {
            chat_id: chatId,
            text: sanitizedText,
            parse_mode: parseMode,
        });
        const messageId = data?.result?.message_id;
        logger.info({ chatId, messageId, duration: Date.now() - startTime }, 'Telegram message sent');
        return messageId;
    }
    catch (error) {
        logger.error({ chatId, error: error instanceof Error ? error.message : String(error) }, 'Telegram API error');
        throw error;
    }
}
async function sendPhoto(logger, botToken, chatId, photoUrl, caption, parseMode = 'HTML') {
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
        logger.info({ chatId, messageId, duration: Date.now() - startTime }, 'Telegram photo sent');
        return messageId;
    }
    catch (error) {
        logger.error({ chatId, error: error instanceof Error ? error.message : String(error) }, 'Telegram API error');
        throw error;
    }
}
async function sendVideo(logger, botToken, chatId, videoUrl, caption, parseMode = 'HTML', cover, thumbnail) {
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
        logger.info({ chatId, messageId, duration: Date.now() - startTime }, 'Telegram video sent');
        return messageId;
    }
    catch (error) {
        logger.error({ chatId, error: error instanceof Error ? error.message : String(error) }, 'Telegram API error');
        throw error;
    }
}
async function sendDocument(logger, botToken, chatId, documentUrl, caption, parseMode = 'HTML') {
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
        logger.info({ chatId, messageId, duration: Date.now() - startTime }, 'Telegram document sent');
        return messageId;
    }
    catch (error) {
        logger.error({ chatId, error: error instanceof Error ? error.message : String(error) }, 'Telegram API error');
        throw error;
    }
}
async function sendAudio(logger, botToken, chatId, audioUrl, caption, parseMode = 'HTML') {
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
        logger.info({ chatId, messageId, duration: Date.now() - startTime }, 'Telegram audio sent');
        return messageId;
    }
    catch (error) {
        logger.error({ chatId, error: error instanceof Error ? error.message : String(error) }, 'Telegram API error');
        throw error;
    }
}
//# sourceMappingURL=telegram.js.map