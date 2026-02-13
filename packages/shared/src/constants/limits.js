"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MEDIA_LIMITS = exports.WEBHOOK_INTEGRATION_LIMITS = exports.WEBHOOK_LIMITS = exports.BOT_LIMITS = exports.RATE_LIMITS = void 0;
const limits_browser_js_1 = require("./limits-browser.js");
const isTestEnv = process.env.NODE_ENV === 'test';
const TEST_RATE_LIMITS = {
    // API endpoints (requests per window)
    API_GENERAL: { windowMs: 1000, max: 3 },
    API_CREATE_BOT: { windowMs: 1000, max: 2 },
    API_UPDATE_SCHEMA: { windowMs: 1000, max: 2 },
    // Webhook endpoints
    WEBHOOK_PER_BOT: { windowMs: 1000, max: 3 },
    WEBHOOK_GLOBAL: { windowMs: 1000, max: 5 },
};
exports.RATE_LIMITS = isTestEnv ? TEST_RATE_LIMITS : limits_browser_js_1.RATE_LIMITS;
exports.BOT_LIMITS = limits_browser_js_1.BOT_LIMITS;
exports.WEBHOOK_LIMITS = limits_browser_js_1.WEBHOOK_LIMITS;
exports.WEBHOOK_INTEGRATION_LIMITS = limits_browser_js_1.WEBHOOK_INTEGRATION_LIMITS;
exports.MEDIA_LIMITS = limits_browser_js_1.MEDIA_LIMITS;
//# sourceMappingURL=limits.js.map