import { type Logger, type LoggerOptions } from 'pino';
export declare function createLogger(service: string, options?: LoggerOptions): Logger;
export declare function createChildLogger(parentLogger: Logger, bindings: Record<string, unknown>): Logger;
export type { Logger, LoggerOptions };
//# sourceMappingURL=logger.d.ts.map