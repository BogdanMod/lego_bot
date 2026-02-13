import type { BotSchema } from '../types/bot-schema.js';
export declare const SCHEMA_CACHE_TTL_SECONDS: number;
export type LoggerLike = {
    error?: (ctx: any, msg?: string) => void;
    warn?: (ctx: any, msg?: string) => void;
    debug?: (ctx: any, msg?: string) => void;
};
export type RedisClientLike = {
    get: (key: string) => Promise<string | null>;
    setEx: (key: string, ttlSeconds: number, value: string) => Promise<any>;
    del: (key: string) => Promise<any>;
};
export interface CachedBotSchemaPayload {
    schema: BotSchema;
    schema_version: number;
}
export declare function getCachedBotSchema(client: RedisClientLike, botId: string, logger?: LoggerLike): Promise<CachedBotSchemaPayload | null>;
export declare function setCachedBotSchema(client: RedisClientLike, botId: string, payload: CachedBotSchemaPayload, logger?: LoggerLike): Promise<void>;
export declare function invalidateBotSchemaCache(client: RedisClientLike, botId: string, logger?: LoggerLike): Promise<void>;
//# sourceMappingURL=bot-schema-cache.d.ts.map