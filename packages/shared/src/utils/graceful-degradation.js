"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRecoverableError = isRecoverableError;
exports.withFallback = withFallback;
exports.retryWithBackoff = retryWithBackoff;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isRecoverableError(error) {
    const code = error.code;
    const message = error.message || '';
    const recoverableCodes = new Set([
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ECONNRESET',
        'EAI_AGAIN',
        'ENOTFOUND',
        'ECONNABORTED',
        'EPIPE',
    ]);
    if (code && recoverableCodes.has(code)) {
        return true;
    }
    return /timeout|temporarily|temporary|network|connection/i.test(message);
}
async function withFallback(primary, fallback, logger) {
    try {
        return await primary();
    }
    catch (error) {
        logger.warn({ error }, 'Primary failed, using fallback');
    }
    try {
        return await fallback();
    }
    catch (error) {
        logger.error({ error }, 'Fallback failed');
        throw error;
    }
}
async function retryWithBackoff(fn, config, logger) {
    let delayMs = config.initialDelayMs;
    let lastError;
    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (!(error instanceof Error) || !isRecoverableError(error)) {
                throw error;
            }
            if (attempt === config.maxRetries) {
                break;
            }
            const jitter = Math.random() * config.jitterMs;
            const nextDelayMs = Math.min(delayMs, config.maxDelayMs);
            const actualDelayMs = nextDelayMs + jitter;
            logger.warn({ attempt, nextDelayMs, jitterMs: jitter, actualDelayMs, error }, 'Retry scheduled');
            await sleep(actualDelayMs);
            delayMs = Math.min(delayMs * config.backoffFactor, config.maxDelayMs);
        }
    }
    throw lastError instanceof Error ? lastError : new Error('Retry failed');
}
//# sourceMappingURL=graceful-degradation.js.map