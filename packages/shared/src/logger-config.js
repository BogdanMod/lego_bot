"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLoggerConfig = getLoggerConfig;
const isVercel = process.env.VERCEL === '1';
const isProduction = process.env.NODE_ENV === 'production';
const logToFile = !isVercel && (process.env.LOG_TO_FILE === 'true' || process.env.LOG_TO_FILE === '1');
const logFilePath = process.env.LOG_FILE_PATH || 'logs/app.log';
const logSizeMb = process.env.LOG_SIZE_MB ?? '100';
const logInterval = process.env.LOG_INTERVAL ?? '1d';
const logMaxFiles = Number(process.env.LOG_MAX_FILES ?? 30);
const redactionPaths = ['req.headers.authorization', 'token', 'password', 'DATABASE_URL'];
function mapIntervalToFrequency(interval) {
    const normalized = interval.toLowerCase();
    if (normalized === '1d' || normalized === 'daily')
        return 'daily';
    if (normalized === '1h' || normalized === 'hourly')
        return 'hourly';
    const ms = parseInt(interval, 10);
    if (!isNaN(ms))
        return ms;
    return 'daily';
}
function getLoggerConfig() {
    const redact = {
        paths: redactionPaths,
        censor: '[REDACTED]',
    };
    const fileTransport = logToFile
        ? {
            transport: {
                target: 'pino-roll',
                options: {
                    file: logFilePath,
                    size: logSizeMb,
                    frequency: mapIntervalToFrequency(logInterval),
                    limit: {
                        count: logMaxFiles,
                    },
                    mkdir: true,
                    // compress не поддерживается в pino-roll
                },
            },
        }
        : {};
    if (isVercel) {
        return {
            level: 'info',
            redact,
        };
    }
    if (!isProduction) {
        if (logToFile) {
            return {
                level: 'debug',
                ...fileTransport,
                redact,
            };
        }
        return {
            level: 'debug',
            transport: {
                target: 'pino-pretty',
                options: {
                    colorize: true,
                },
            },
            redact,
        };
    }
    return {
        level: 'warn',
        ...fileTransport,
        redact,
    };
}
//# sourceMappingURL=logger-config.js.map