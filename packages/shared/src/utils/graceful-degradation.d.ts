import type { Logger } from '../logger.js';
export type RetryConfig = {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffFactor: number;
    jitterMs: number;
};
export declare function isRecoverableError(error: Error): boolean;
export declare function withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>, logger: Logger): Promise<T>;
export declare function retryWithBackoff<T>(fn: () => Promise<T>, config: RetryConfig, logger: Logger): Promise<T>;
//# sourceMappingURL=graceful-degradation.d.ts.map