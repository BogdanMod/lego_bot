export declare const RATE_LIMITS: {
    API_GENERAL: {
        windowMs: number;
        max: number;
    };
    API_CREATE_BOT: {
        windowMs: number;
        max: number;
    };
    API_UPDATE_SCHEMA: {
        windowMs: number;
        max: number;
    };
    WEBHOOK_PER_BOT: {
        windowMs: number;
        max: number;
    };
    WEBHOOK_GLOBAL: {
        windowMs: number;
        max: number;
    };
};
export declare const BOT_LIMITS: {
    MAX_BOTS_PER_USER: number;
    MAX_SCHEMA_STATES: number;
    MAX_BUTTONS_PER_STATE: number;
    MAX_MESSAGE_LENGTH: number;
    MAX_BUTTON_TEXT_LENGTH: number;
    MAX_STATE_KEY_LENGTH: number;
};
export declare const WEBHOOK_LIMITS: {
    MAX_PAYLOAD_SIZE: number;
    SECRET_TOKEN_LENGTH: number;
};
export declare const WEBHOOK_INTEGRATION_LIMITS: {
    MAX_URL_LENGTH: number;
    MAX_HEADERS: number;
    MAX_HEADER_VALUE_LENGTH: number;
    MAX_RETRY_COUNT: number;
    TIMEOUT_MS: number;
    AWAIT_FIRST_ATTEMPT_TIMEOUT_MS: number;
    MAX_WEBHOOKS_PER_BOT: number;
    MAX_SIGNING_SECRET_LENGTH: number;
    MAX_LOG_PAYLOAD_BYTES: number;
    MAX_LOG_RESPONSE_BODY_BYTES: number;
    MAX_LOG_ERROR_MESSAGE_LENGTH: number;
};
export declare const MEDIA_LIMITS: {
    MAX_MEDIA_URL_LENGTH: number;
    MAX_CAPTION_LENGTH: number;
    MAX_MEDIA_GROUP_SIZE: number;
    ALLOWED_MEDIA_TYPES: readonly ["photo", "video", "document", "audio"];
};
//# sourceMappingURL=limits-browser.d.ts.map