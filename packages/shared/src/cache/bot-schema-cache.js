"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCHEMA_CACHE_TTL_SECONDS = void 0;
exports.getCachedBotSchema = getCachedBotSchema;
exports.setCachedBotSchema = setCachedBotSchema;
exports.invalidateBotSchemaCache = invalidateBotSchemaCache;
exports.SCHEMA_CACHE_TTL_SECONDS = 5 * 60;
const schemaKey = (botId) => `bot:${botId}:schema`;
async function getCachedBotSchema(client, botId, logger) {
    try {
        const cached = await client.get(schemaKey(botId));
        if (!cached)
            return null;
        return JSON.parse(cached);
    }
    catch (error) {
        logger?.error?.({ service: 'redis', operation: 'getCachedBotSchema', botId, error }, 'Error getting cached schema');
        return null;
    }
}
async function setCachedBotSchema(client, botId, payload, logger) {
    try {
        await client.setEx(schemaKey(botId), exports.SCHEMA_CACHE_TTL_SECONDS, JSON.stringify(payload));
    }
    catch (error) {
        logger?.error?.({ service: 'redis', operation: 'setCachedBotSchema', botId, error }, 'Error caching schema');
    }
}
async function invalidateBotSchemaCache(client, botId, logger) {
    try {
        await client.del(schemaKey(botId));
    }
    catch (error) {
        logger?.error?.({ service: 'redis', operation: 'invalidateBotSchemaCache', botId, error }, 'Error invalidating schema cache');
    }
}
//# sourceMappingURL=bot-schema-cache.js.map