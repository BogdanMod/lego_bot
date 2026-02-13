"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramUpdateSchema = exports.UpdateBroadcastStatusSchema = exports.BroadcastIdSchema = exports.CreateBroadcastSchema = exports.PaginationSchema = exports.UserIdSchema = exports.BotIdSchema = exports.UpdateBotSchemaSchema = exports.CreateBotSchema = void 0;
const zod_1 = require("zod");
const sanitize_js_1 = require("../utils/sanitize.js");
exports.CreateBotSchema = zod_1.z.object({
    token: zod_1.z.string().regex(/^\d+:[A-Za-z0-9_-]{35}$/),
    name: zod_1.z.string().min(1).max(100).transform(sanitize_js_1.sanitizeText),
});
const ButtonSchema = zod_1.z.preprocess((value) => {
    if (!value || typeof value !== 'object') {
        return value;
    }
    const button = value;
    if (button.type === undefined) {
        return { ...button, type: 'navigation' };
    }
    return button;
}, zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        type: zod_1.z.literal('navigation'),
        text: zod_1.z.string().transform(sanitize_js_1.sanitizeText),
        nextState: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('url'),
        text: zod_1.z.string().transform(sanitize_js_1.sanitizeText),
        url: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('request_contact'),
        text: zod_1.z.string().transform(sanitize_js_1.sanitizeText),
        nextState: zod_1.z.string(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('request_email'),
        text: zod_1.z.string().transform(sanitize_js_1.sanitizeText),
        nextState: zod_1.z.string(),
    }),
]));
const WebhookConfigSchema = zod_1.z.object({
    url: zod_1.z.string(),
    method: zod_1.z.enum(['POST', 'GET']).optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    signingSecret: zod_1.z.string().optional(),
    enabled: zod_1.z.boolean(),
    retryCount: zod_1.z.number().int().nonnegative().optional(),
    timeout: zod_1.z.number().int().positive().optional(),
});
const IntegrationTemplateSchema = zod_1.z.object({
    type: zod_1.z.enum(['google_sheets', 'telegram_channel', 'custom']),
    config: zod_1.z.record(zod_1.z.any()),
});
const MediaSchema = zod_1.z.object({
    type: zod_1.z.enum(['photo', 'video', 'document', 'audio']),
    url: zod_1.z.string(),
    caption: zod_1.z.string().optional(),
    thumbnail: zod_1.z.string().optional(),
    cover: zod_1.z.string().optional(),
});
const MediaGroupItemSchema = zod_1.z.object({
    type: zod_1.z.enum(['photo', 'video']),
    url: zod_1.z.string(),
    caption: zod_1.z.string().optional(),
});
const StateSchema = zod_1.z.object({
    message: zod_1.z.string().transform(sanitize_js_1.sanitizeText),
    media: MediaSchema.optional(),
    mediaGroup: zod_1.z.array(MediaGroupItemSchema).optional(),
    parseMode: zod_1.z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
    buttons: zod_1.z.array(ButtonSchema).optional(),
    webhook: WebhookConfigSchema.optional(),
    integration: IntegrationTemplateSchema.optional(),
});
exports.UpdateBotSchemaSchema = zod_1.z.object({
    version: zod_1.z.literal(1),
    states: zod_1.z.record(StateSchema),
    initialState: zod_1.z.string(),
});
exports.BotIdSchema = zod_1.z.string().uuid();
exports.UserIdSchema = zod_1.z.number().int().positive();
exports.PaginationSchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    cursor: zod_1.z.string().optional(),
});
exports.CreateBroadcastSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).transform(sanitize_js_1.sanitizeText),
    message: zod_1.z.string().min(1).max(4096).transform(sanitize_js_1.sanitizeText),
    media: MediaSchema.optional(),
    parseMode: zod_1.z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
    scheduledAt: zod_1.z.string().datetime().optional(),
});
exports.BroadcastIdSchema = zod_1.z.string().uuid();
exports.UpdateBroadcastStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['draft', 'scheduled', 'processing', 'completed', 'cancelled']),
});
exports.TelegramUpdateSchema = zod_1.z.object({
    update_id: zod_1.z.number(),
    message: zod_1.z
        .object({
        message_id: zod_1.z.number(),
        from: zod_1.z
            .object({
            id: zod_1.z.number(),
            first_name: zod_1.z.string().optional(),
            last_name: zod_1.z.string().optional(),
            username: zod_1.z.string().optional(),
            language_code: zod_1.z.string().optional(),
        })
            .optional(),
        chat: zod_1.z.object({
            id: zod_1.z.number(),
        }),
        text: zod_1.z.string().optional(),
        contact: zod_1.z
            .object({
            phone_number: zod_1.z.string(),
            first_name: zod_1.z.string(),
            last_name: zod_1.z.string().optional(),
            user_id: zod_1.z.number().optional(),
        })
            .optional(),
    })
        .optional(),
    callback_query: zod_1.z
        .object({
        id: zod_1.z.string(),
        from: zod_1.z.object({
            id: zod_1.z.number(),
            first_name: zod_1.z.string().optional(),
            last_name: zod_1.z.string().optional(),
            username: zod_1.z.string().optional(),
            language_code: zod_1.z.string().optional(),
        }),
        message: zod_1.z
            .object({
            message_id: zod_1.z.number(),
            chat: zod_1.z.object({
                id: zod_1.z.number(),
            }),
        })
            .optional(),
        data: zod_1.z.string(),
    })
        .optional(),
}).passthrough();
//# sourceMappingURL=schemas.js.map