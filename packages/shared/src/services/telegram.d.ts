import type { Logger } from '../logger.js';
export declare function sendTelegramMessage(logger: Logger, botToken: string, chatId: number, text: string, parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'): Promise<number | undefined>;
export declare function sendPhoto(logger: Logger, botToken: string, chatId: number, photoUrl: string, caption?: string, parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'): Promise<number | undefined>;
export declare function sendVideo(logger: Logger, botToken: string, chatId: number, videoUrl: string, caption?: string, parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2', cover?: string, thumbnail?: string): Promise<number | undefined>;
export declare function sendDocument(logger: Logger, botToken: string, chatId: number, documentUrl: string, caption?: string, parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'): Promise<number | undefined>;
export declare function sendAudio(logger: Logger, botToken: string, chatId: number, audioUrl: string, caption?: string, parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2'): Promise<number | undefined>;
//# sourceMappingURL=telegram.d.ts.map