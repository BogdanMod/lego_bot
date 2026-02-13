import type { Logger } from '../logger.js';
export type CircuitState = 'closed' | 'open' | 'half-open';
export type CircuitBreakerOptions = {
    failureThreshold: number;
    resetTimeout: number;
    successThreshold: number;
    halfOpenMaxRequests?: number;
    isFailure?: (error: unknown) => boolean;
};
export declare class CircuitBreakerOpenError extends Error {
    readonly service: string;
    constructor(service: string, message?: string);
}
export declare class CircuitBreaker {
    private readonly serviceName;
    private readonly options;
    private state;
    private failureCount;
    private successCount;
    private lastFailureTime;
    private lastSuccessTime;
    private lastTransitionTime;
    private openSince;
    private halfOpenInFlight;
    private logger;
    constructor(serviceName: string, options: CircuitBreakerOptions, logger?: Logger);
    setLogger(logger?: Logger): void;
    getState(): CircuitState;
    getStats(): {
        service: string;
        state: CircuitState;
        failureCount: number;
        successCount: number;
        lastFailureTime: number | null;
        lastSuccessTime: number | null;
        lastTransitionTime: number;
        openSince: number | null;
        halfOpenInFlight: number;
        failureThreshold: number;
        successThreshold: number;
        resetTimeout: number;
        halfOpenMaxRequests: number;
    };
    execute<T>(fn: () => Promise<T>): Promise<T>;
    private onSuccess;
    private onFailure;
    private transitionTo;
    private logTransition;
}
//# sourceMappingURL=circuit-breaker.d.ts.map