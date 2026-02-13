export declare const logger: import("node_modules/pino/pino.js").Logger;
export * from './logger.js';
export * from './constants/limits.js';
export * from './types/bot-schema.js';
export * from './types/owner.js';
export * from './services/telegram.js';
export * from './utils/circuit-breaker.js';
export * from './utils/graceful-degradation.js';
export * from './utils/sanitize.js';
export * from './utils/telegram-auth.js';
export * from './validation/bot-schema-validation.js';
export * from './validation/schemas.js';
export * from './db/bot-users.js';
export * from './db/bot-analytics.js';
export * from './env/getTelegramBotToken.js';
export interface User {
    id: number;
    telegramId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface Bot {
    id: string;
    token: string;
    name: string;
    userId: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface Dialogue {
    id: string;
    botId: string;
    name: string;
    nodes: DialogueNode[];
    edges: DialogueEdge[];
    createdAt: Date;
    updatedAt: Date;
}
export interface DialogueNode {
    id: string;
    type: 'message' | 'question' | 'condition' | 'action';
    data: Record<string, any>;
    position: {
        x: number;
        y: number;
    };
}
export interface DialogueEdge {
    id: string;
    source: string;
    target: string;
    condition?: string;
}
//# sourceMappingURL=index.d.ts.map