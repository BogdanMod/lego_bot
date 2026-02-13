"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTelegramWebAppData = validateTelegramWebAppData;
const crypto_1 = __importDefault(require("crypto"));
function validateTelegramWebAppData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) {
            return { valid: false };
        }
        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');
        const secretKey = crypto_1.default
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();
        const calculatedHash = crypto_1.default
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        if (calculatedHash !== hash) {
            return { valid: false };
        }
        const userRaw = params.get('user');
        if (!userRaw) {
            return { valid: false };
        }
        const user = JSON.parse(userRaw);
        if (!user?.id || typeof user.id !== 'number') {
            return { valid: false };
        }
        return { valid: true, userId: user.id };
    }
    catch {
        return { valid: false };
    }
}
//# sourceMappingURL=telegram-auth.js.map