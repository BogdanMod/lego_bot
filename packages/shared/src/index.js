"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
// Shared types and utilities
// For browser bundles use "@dialogue-constructor/shared/browser"; for server use "@dialogue-constructor/shared" or "@dialogue-constructor/shared/server".
const logger_js_1 = require("./logger.js");
exports.logger = (0, logger_js_1.createLogger)('shared');
__exportStar(require("./logger.js"), exports);
__exportStar(require("./constants/limits.js"), exports);
__exportStar(require("./types/bot-schema.js"), exports);
__exportStar(require("./types/owner.js"), exports);
__exportStar(require("./services/telegram.js"), exports);
__exportStar(require("./utils/circuit-breaker.js"), exports);
__exportStar(require("./utils/graceful-degradation.js"), exports);
__exportStar(require("./utils/sanitize.js"), exports);
__exportStar(require("./utils/telegram-auth.js"), exports);
__exportStar(require("./validation/bot-schema-validation.js"), exports);
__exportStar(require("./validation/schemas.js"), exports);
__exportStar(require("./db/bot-users.js"), exports);
__exportStar(require("./db/bot-analytics.js"), exports);
// Cache metrics moved to core (express-dependent)
__exportStar(require("./env/getTelegramBotToken.js"), exports);
//# sourceMappingURL=index.js.map