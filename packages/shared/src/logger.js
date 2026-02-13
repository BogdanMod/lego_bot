"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
exports.createChildLogger = createChildLogger;
const pino_1 = require("pino");
const logger_config_js_1 = require("./logger-config.js");
const isVercel = process.env.VERCEL === '1';
const logMethods = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'];
function serializeRequest(req) {
    return {
        method: req?.method,
        url: req?.url,
        headers: req?.headers,
        ip: req?.ip,
    };
}
function serializeResponse(res) {
    return {
        statusCode: res?.statusCode,
        headers: res?.getHeaders ? res.getHeaders() : res?.headers,
    };
}
function wrapLogger(baseLogger) {
    return new Proxy(baseLogger, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === 'function' && logMethods.includes(prop)) {
                return (first, second, ...rest) => {
                    if (typeof first === 'string'
                        && second
                        && typeof second === 'object'
                        && !Array.isArray(second)) {
                        return value.call(target, second, first, ...rest);
                    }
                    return value.call(target, first, second, ...rest);
                };
            }
            return value;
        },
    });
}
function createLogger(service, options = {}) {
    const baseConfig = (0, logger_config_js_1.getLoggerConfig)();
    const levelFromEnv = process.env.LOG_LEVEL;
    const resolvedLevel = options.level ??
        (isVercel ? levelFromEnv || 'info' : levelFromEnv || baseConfig.level);
    const serializers = {
        err: pino_1.pino.stdSerializers.err,
        req: serializeRequest,
        res: serializeResponse,
    };
    const loggerOptions = {
        ...baseConfig,
        ...options,
        level: resolvedLevel,
        formatters: {
            level: (label) => ({ level: label }),
        },
        timestamp: pino_1.pino.stdTimeFunctions.isoTime,
        serializers: {
            ...serializers,
            ...options.serializers,
        },
        base: {
            service,
            ...options.base,
        },
    };
    return wrapLogger((0, pino_1.pino)(loggerOptions));
}
function createChildLogger(parentLogger, bindings) {
    return wrapLogger(parentLogger.child(bindings));
}
//# sourceMappingURL=logger.js.map