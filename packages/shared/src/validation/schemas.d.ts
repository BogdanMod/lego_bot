import { z } from 'zod';
export declare const CreateBotSchema: z.ZodObject<{
    token: z.ZodString;
    name: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    token: string;
    name: string;
}, {
    token: string;
    name: string;
}>;
export declare const UpdateBotSchemaSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    states: z.ZodRecord<z.ZodString, z.ZodObject<{
        message: z.ZodEffects<z.ZodString, string, string>;
        media: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["photo", "video", "document", "audio"]>;
            url: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
            thumbnail: z.ZodOptional<z.ZodString>;
            cover: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            type: "photo" | "video" | "document" | "audio";
            caption?: string | undefined;
            cover?: string | undefined;
            thumbnail?: string | undefined;
        }, {
            url: string;
            type: "photo" | "video" | "document" | "audio";
            caption?: string | undefined;
            cover?: string | undefined;
            thumbnail?: string | undefined;
        }>>;
        mediaGroup: z.ZodOptional<z.ZodArray<z.ZodObject<{
            type: z.ZodEnum<["photo", "video"]>;
            url: z.ZodString;
            caption: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            type: "photo" | "video";
            caption?: string | undefined;
        }, {
            url: string;
            type: "photo" | "video";
            caption?: string | undefined;
        }>, "many">>;
        parseMode: z.ZodOptional<z.ZodEnum<["HTML", "Markdown", "MarkdownV2"]>>;
        buttons: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"navigation">;
            text: z.ZodEffects<z.ZodString, string, string>;
            nextState: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            nextState: string;
            text: string;
            type: "navigation";
        }, {
            nextState: string;
            text: string;
            type: "navigation";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"url">;
            text: z.ZodEffects<z.ZodString, string, string>;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            url: string;
            text: string;
            type: "url";
        }, {
            url: string;
            text: string;
            type: "url";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"request_contact">;
            text: z.ZodEffects<z.ZodString, string, string>;
            nextState: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            nextState: string;
            text: string;
            type: "request_contact";
        }, {
            nextState: string;
            text: string;
            type: "request_contact";
        }>, z.ZodObject<{
            type: z.ZodLiteral<"request_email">;
            text: z.ZodEffects<z.ZodString, string, string>;
            nextState: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            nextState: string;
            text: string;
            type: "request_email";
        }, {
            nextState: string;
            text: string;
            type: "request_email";
        }>]>, {
            nextState: string;
            text: string;
            type: "navigation";
        } | {
            url: string;
            text: string;
            type: "url";
        } | {
            nextState: string;
            text: string;
            type: "request_contact";
        } | {
            nextState: string;
            text: string;
            type: "request_email";
        }, unknown>, "many">>;
        webhook: z.ZodOptional<z.ZodObject<{
            url: z.ZodString;
            method: z.ZodOptional<z.ZodEnum<["POST", "GET"]>>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            signingSecret: z.ZodOptional<z.ZodString>;
            enabled: z.ZodBoolean;
            retryCount: z.ZodOptional<z.ZodNumber>;
            timeout: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            url: string;
            enabled: boolean;
            method?: "POST" | "GET" | undefined;
            headers?: Record<string, string> | undefined;
            signingSecret?: string | undefined;
            retryCount?: number | undefined;
            timeout?: number | undefined;
        }, {
            url: string;
            enabled: boolean;
            method?: "POST" | "GET" | undefined;
            headers?: Record<string, string> | undefined;
            signingSecret?: string | undefined;
            retryCount?: number | undefined;
            timeout?: number | undefined;
        }>>;
        integration: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<["google_sheets", "telegram_channel", "custom"]>;
            config: z.ZodRecord<z.ZodString, z.ZodAny>;
        }, "strip", z.ZodTypeAny, {
            type: "google_sheets" | "telegram_channel" | "custom";
            config: Record<string, any>;
        }, {
            type: "google_sheets" | "telegram_channel" | "custom";
            config: Record<string, any>;
        }>>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        media?: {
            url: string;
            type: "photo" | "video" | "document" | "audio";
            caption?: string | undefined;
            cover?: string | undefined;
            thumbnail?: string | undefined;
        } | undefined;
        mediaGroup?: {
            url: string;
            type: "photo" | "video";
            caption?: string | undefined;
        }[] | undefined;
        parseMode?: "HTML" | "Markdown" | "MarkdownV2" | undefined;
        buttons?: ({
            nextState: string;
            text: string;
            type: "navigation";
        } | {
            url: string;
            text: string;
            type: "url";
        } | {
            nextState: string;
            text: string;
            type: "request_contact";
        } | {
            nextState: string;
            text: string;
            type: "request_email";
        })[] | undefined;
        webhook?: {
            url: string;
            enabled: boolean;
            method?: "POST" | "GET" | undefined;
            headers?: Record<string, string> | undefined;
            signingSecret?: string | undefined;
            retryCount?: number | undefined;
            timeout?: number | undefined;
        } | undefined;
        integration?: {
            type: "google_sheets" | "telegram_channel" | "custom";
            config: Record<string, any>;
        } | undefined;
    }, {
        message: string;
        media?: {
            url: string;
            type: "photo" | "video" | "document" | "audio";
            caption?: string | undefined;
            cover?: string | undefined;
            thumbnail?: string | undefined;
        } | undefined;
        mediaGroup?: {
            url: string;
            type: "photo" | "video";
            caption?: string | undefined;
        }[] | undefined;
        parseMode?: "HTML" | "Markdown" | "MarkdownV2" | undefined;
        buttons?: unknown[] | undefined;
        webhook?: {
            url: string;
            enabled: boolean;
            method?: "POST" | "GET" | undefined;
            headers?: Record<string, string> | undefined;
            signingSecret?: string | undefined;
            retryCount?: number | undefined;
            timeout?: number | undefined;
        } | undefined;
        integration?: {
            type: "google_sheets" | "telegram_channel" | "custom";
            config: Record<string, any>;
        } | undefined;
    }>>;
    initialState: z.ZodString;
}, "strip", z.ZodTypeAny, {
    version: 1;
    states: Record<string, {
        message: string;
        media?: {
            url: string;
            type: "photo" | "video" | "document" | "audio";
            caption?: string | undefined;
            cover?: string | undefined;
            thumbnail?: string | undefined;
        } | undefined;
        mediaGroup?: {
            url: string;
            type: "photo" | "video";
            caption?: string | undefined;
        }[] | undefined;
        parseMode?: "HTML" | "Markdown" | "MarkdownV2" | undefined;
        buttons?: ({
            nextState: string;
            text: string;
            type: "navigation";
        } | {
            url: string;
            text: string;
            type: "url";
        } | {
            nextState: string;
            text: string;
            type: "request_contact";
        } | {
            nextState: string;
            text: string;
            type: "request_email";
        })[] | undefined;
        webhook?: {
            url: string;
            enabled: boolean;
            method?: "POST" | "GET" | undefined;
            headers?: Record<string, string> | undefined;
            signingSecret?: string | undefined;
            retryCount?: number | undefined;
            timeout?: number | undefined;
        } | undefined;
        integration?: {
            type: "google_sheets" | "telegram_channel" | "custom";
            config: Record<string, any>;
        } | undefined;
    }>;
    initialState: string;
}, {
    version: 1;
    states: Record<string, {
        message: string;
        media?: {
            url: string;
            type: "photo" | "video" | "document" | "audio";
            caption?: string | undefined;
            cover?: string | undefined;
            thumbnail?: string | undefined;
        } | undefined;
        mediaGroup?: {
            url: string;
            type: "photo" | "video";
            caption?: string | undefined;
        }[] | undefined;
        parseMode?: "HTML" | "Markdown" | "MarkdownV2" | undefined;
        buttons?: unknown[] | undefined;
        webhook?: {
            url: string;
            enabled: boolean;
            method?: "POST" | "GET" | undefined;
            headers?: Record<string, string> | undefined;
            signingSecret?: string | undefined;
            retryCount?: number | undefined;
            timeout?: number | undefined;
        } | undefined;
        integration?: {
            type: "google_sheets" | "telegram_channel" | "custom";
            config: Record<string, any>;
        } | undefined;
    }>;
    initialState: string;
}>;
export declare const BotIdSchema: z.ZodString;
export declare const UserIdSchema: z.ZodNumber;
export declare const PaginationSchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodNumber>;
    cursor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    limit: number;
    cursor?: string | undefined;
}, {
    limit?: number | undefined;
    cursor?: string | undefined;
}>;
export declare const CreateBroadcastSchema: z.ZodObject<{
    name: z.ZodEffects<z.ZodString, string, string>;
    message: z.ZodEffects<z.ZodString, string, string>;
    media: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["photo", "video", "document", "audio"]>;
        url: z.ZodString;
        caption: z.ZodOptional<z.ZodString>;
        thumbnail: z.ZodOptional<z.ZodString>;
        cover: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        url: string;
        type: "photo" | "video" | "document" | "audio";
        caption?: string | undefined;
        cover?: string | undefined;
        thumbnail?: string | undefined;
    }, {
        url: string;
        type: "photo" | "video" | "document" | "audio";
        caption?: string | undefined;
        cover?: string | undefined;
        thumbnail?: string | undefined;
    }>>;
    parseMode: z.ZodOptional<z.ZodEnum<["HTML", "Markdown", "MarkdownV2"]>>;
    scheduledAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    message: string;
    media?: {
        url: string;
        type: "photo" | "video" | "document" | "audio";
        caption?: string | undefined;
        cover?: string | undefined;
        thumbnail?: string | undefined;
    } | undefined;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2" | undefined;
    scheduledAt?: string | undefined;
}, {
    name: string;
    message: string;
    media?: {
        url: string;
        type: "photo" | "video" | "document" | "audio";
        caption?: string | undefined;
        cover?: string | undefined;
        thumbnail?: string | undefined;
    } | undefined;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2" | undefined;
    scheduledAt?: string | undefined;
}>;
export declare const BroadcastIdSchema: z.ZodString;
export declare const UpdateBroadcastStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["draft", "scheduled", "processing", "completed", "cancelled"]>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "draft" | "scheduled" | "processing" | "completed";
}, {
    status: "cancelled" | "draft" | "scheduled" | "processing" | "completed";
}>;
export declare const TelegramUpdateSchema: z.ZodObject<{
    update_id: z.ZodNumber;
    message: z.ZodOptional<z.ZodObject<{
        message_id: z.ZodNumber;
        from: z.ZodOptional<z.ZodObject<{
            id: z.ZodNumber;
            first_name: z.ZodOptional<z.ZodString>;
            last_name: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            language_code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }>>;
        chat: z.ZodObject<{
            id: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: number;
        }, {
            id: number;
        }>;
        text: z.ZodOptional<z.ZodString>;
        contact: z.ZodOptional<z.ZodObject<{
            phone_number: z.ZodString;
            first_name: z.ZodString;
            last_name: z.ZodOptional<z.ZodString>;
            user_id: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        }, {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string | undefined;
        from?: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        } | undefined;
        contact?: {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        } | undefined;
    }, {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string | undefined;
        from?: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        } | undefined;
        contact?: {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        } | undefined;
    }>>;
    callback_query: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        from: z.ZodObject<{
            id: z.ZodNumber;
            first_name: z.ZodOptional<z.ZodString>;
            last_name: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            language_code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }>;
        message: z.ZodOptional<z.ZodObject<{
            message_id: z.ZodNumber;
            chat: z.ZodObject<{
                id: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                id: number;
            }, {
                id: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            message_id: number;
            chat: {
                id: number;
            };
        }, {
            message_id: number;
            chat: {
                id: number;
            };
        }>>;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        from: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        };
        data: string;
        message?: {
            message_id: number;
            chat: {
                id: number;
            };
        } | undefined;
    }, {
        id: string;
        from: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        };
        data: string;
        message?: {
            message_id: number;
            chat: {
                id: number;
            };
        } | undefined;
    }>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    update_id: z.ZodNumber;
    message: z.ZodOptional<z.ZodObject<{
        message_id: z.ZodNumber;
        from: z.ZodOptional<z.ZodObject<{
            id: z.ZodNumber;
            first_name: z.ZodOptional<z.ZodString>;
            last_name: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            language_code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }>>;
        chat: z.ZodObject<{
            id: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: number;
        }, {
            id: number;
        }>;
        text: z.ZodOptional<z.ZodString>;
        contact: z.ZodOptional<z.ZodObject<{
            phone_number: z.ZodString;
            first_name: z.ZodString;
            last_name: z.ZodOptional<z.ZodString>;
            user_id: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        }, {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string | undefined;
        from?: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        } | undefined;
        contact?: {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        } | undefined;
    }, {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string | undefined;
        from?: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        } | undefined;
        contact?: {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        } | undefined;
    }>>;
    callback_query: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        from: z.ZodObject<{
            id: z.ZodNumber;
            first_name: z.ZodOptional<z.ZodString>;
            last_name: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            language_code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }>;
        message: z.ZodOptional<z.ZodObject<{
            message_id: z.ZodNumber;
            chat: z.ZodObject<{
                id: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                id: number;
            }, {
                id: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            message_id: number;
            chat: {
                id: number;
            };
        }, {
            message_id: number;
            chat: {
                id: number;
            };
        }>>;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        from: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        };
        data: string;
        message?: {
            message_id: number;
            chat: {
                id: number;
            };
        } | undefined;
    }, {
        id: string;
        from: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        };
        data: string;
        message?: {
            message_id: number;
            chat: {
                id: number;
            };
        } | undefined;
    }>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    update_id: z.ZodNumber;
    message: z.ZodOptional<z.ZodObject<{
        message_id: z.ZodNumber;
        from: z.ZodOptional<z.ZodObject<{
            id: z.ZodNumber;
            first_name: z.ZodOptional<z.ZodString>;
            last_name: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            language_code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }>>;
        chat: z.ZodObject<{
            id: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: number;
        }, {
            id: number;
        }>;
        text: z.ZodOptional<z.ZodString>;
        contact: z.ZodOptional<z.ZodObject<{
            phone_number: z.ZodString;
            first_name: z.ZodString;
            last_name: z.ZodOptional<z.ZodString>;
            user_id: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        }, {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string | undefined;
        from?: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        } | undefined;
        contact?: {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        } | undefined;
    }, {
        message_id: number;
        chat: {
            id: number;
        };
        text?: string | undefined;
        from?: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        } | undefined;
        contact?: {
            first_name: string;
            phone_number: string;
            last_name?: string | undefined;
            user_id?: number | undefined;
        } | undefined;
    }>>;
    callback_query: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        from: z.ZodObject<{
            id: z.ZodNumber;
            first_name: z.ZodOptional<z.ZodString>;
            last_name: z.ZodOptional<z.ZodString>;
            username: z.ZodOptional<z.ZodString>;
            language_code: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }, {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        }>;
        message: z.ZodOptional<z.ZodObject<{
            message_id: z.ZodNumber;
            chat: z.ZodObject<{
                id: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                id: number;
            }, {
                id: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            message_id: number;
            chat: {
                id: number;
            };
        }, {
            message_id: number;
            chat: {
                id: number;
            };
        }>>;
        data: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        from: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        };
        data: string;
        message?: {
            message_id: number;
            chat: {
                id: number;
            };
        } | undefined;
    }, {
        id: string;
        from: {
            id: number;
            first_name?: string | undefined;
            last_name?: string | undefined;
            username?: string | undefined;
            language_code?: string | undefined;
        };
        data: string;
        message?: {
            message_id: number;
            chat: {
                id: number;
            };
        } | undefined;
    }>>;
}, z.ZodTypeAny, "passthrough">>;
//# sourceMappingURL=schemas.d.ts.map