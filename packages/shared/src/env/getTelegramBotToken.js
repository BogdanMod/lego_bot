"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelegramBotToken = getTelegramBotToken;
let warned = false;
function getTelegramBotToken() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN;
    if (!process.env.TELEGRAM_BOT_TOKEN && process.env.BOT_TOKEN && !warned) {
        warned = true;
        console.warn('BOT_TOKEN is deprecated; use TELEGRAM_BOT_TOKEN instead');
    }
    return botToken;
}
//# sourceMappingURL=getTelegramBotToken.js.map