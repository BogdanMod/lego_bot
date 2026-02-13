"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = exports.CircuitBreakerOpenError = void 0;
class CircuitBreakerOpenError extends Error {
    constructor(service, message) {
        super(message || `Circuit breaker for ${service} is open`);
        this.name = 'CircuitBreakerOpenError';
        this.service = service;
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
class CircuitBreaker {
    constructor(serviceName, options, logger) {
        this.serviceName = serviceName;
        this.options = options;
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastSuccessTime = null;
        this.lastTransitionTime = Date.now();
        this.openSince = null;
        this.halfOpenInFlight = 0;
        this.logger = null;
        this.logger = logger ?? null;
    }
    setLogger(logger) {
        this.logger = logger ?? null;
    }
    getState() {
        return this.state;
    }
    getStats() {
        return {
            service: this.serviceName,
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            lastTransitionTime: this.lastTransitionTime,
            openSince: this.openSince,
            halfOpenInFlight: this.halfOpenInFlight,
            failureThreshold: this.options.failureThreshold,
            successThreshold: this.options.successThreshold,
            resetTimeout: this.options.resetTimeout,
            halfOpenMaxRequests: this.options.halfOpenMaxRequests ?? 1,
        };
    }
    async execute(fn) {
        if (this.state === 'open') {
            if (this.openSince && Date.now() - this.openSince >= this.options.resetTimeout) {
                this.transitionTo('half-open');
            }
            else {
                throw new CircuitBreakerOpenError(this.serviceName);
            }
        }
        if (this.state === 'half-open') {
            const maxRequests = this.options.halfOpenMaxRequests ?? 1;
            if (this.halfOpenInFlight >= maxRequests) {
                throw new CircuitBreakerOpenError(this.serviceName, `Circuit breaker for ${this.serviceName} is half-open`);
            }
            this.halfOpenInFlight += 1;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure(error);
            throw error;
        }
        finally {
            if (this.state === 'half-open' && this.halfOpenInFlight > 0) {
                this.halfOpenInFlight -= 1;
            }
        }
    }
    onSuccess() {
        this.lastSuccessTime = Date.now();
        if (this.state === 'half-open') {
            this.successCount += 1;
            if (this.successCount >= this.options.successThreshold) {
                this.transitionTo('closed');
            }
            return;
        }
        this.failureCount = 0;
    }
    onFailure(error) {
        if (this.options.isFailure && !this.options.isFailure(error)) {
            return;
        }
        this.lastFailureTime = Date.now();
        if (this.state === 'half-open') {
            this.transitionTo('open');
            return;
        }
        this.failureCount += 1;
        if (this.failureCount >= this.options.failureThreshold) {
            this.transitionTo('open');
        }
    }
    transitionTo(state) {
        if (this.state === state) {
            return;
        }
        const previousState = this.state;
        const now = Date.now();
        this.state = state;
        this.lastTransitionTime = now;
        if (state === 'open') {
            this.openSince = now;
            this.successCount = 0;
        }
        if (state === 'half-open') {
            this.failureCount = 0;
            this.successCount = 0;
            this.openSince = null;
            this.halfOpenInFlight = 0;
        }
        if (state === 'closed') {
            this.failureCount = 0;
            this.successCount = 0;
            this.openSince = null;
            this.halfOpenInFlight = 0;
        }
        this.logTransition(previousState, state, now);
    }
    logTransition(previousState, nextState, timestampMs) {
        const context = {
            service: this.serviceName,
            previousState,
            nextState,
            failureCount: this.failureCount,
            successCount: this.successCount,
            timestamp: new Date(timestampMs).toISOString(),
        };
        if (nextState === 'open') {
            this.logger?.warn(context, 'Circuit breaker opened');
            return;
        }
        this.logger?.info(context, 'Circuit breaker state transition');
    }
}
exports.CircuitBreaker = CircuitBreaker;
//# sourceMappingURL=circuit-breaker.js.map