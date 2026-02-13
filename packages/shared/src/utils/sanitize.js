"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHtml = sanitizeHtml;
exports.sanitizeText = sanitizeText;
exports.sanitizeBotSchema = sanitizeBotSchema;
function sanitizeHtml(input) {
    return sanitizeText(input.replace(/<[^>]*>/g, ''));
}
function sanitizeText(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function sanitizeBotSchema(schema) {
    const sanitizedStates = {};
    for (const [stateKey, state] of Object.entries(schema.states)) {
        sanitizedStates[stateKey] = {
            ...state,
            message: sanitizeText(state.message),
            buttons: state.buttons?.map((button) => ({
                ...button,
                text: sanitizeText(button.text),
            })),
        };
    }
    return {
        ...schema,
        states: sanitizedStates,
    };
}
//# sourceMappingURL=sanitize.js.map