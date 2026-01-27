import { WEBHOOK_INTEGRATION_LIMITS } from '@dialogue-constructor/shared';
import { getPostgresClient } from './postgres';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(\+?\d[\d\s()-]{6,}\d)/g;

const maskSensitive = (value: string) =>
  value.replace(EMAIL_REGEX, '[redacted]').replace(PHONE_REGEX, '[redacted]');

const truncateBytes = (value: string, maxBytes: number) => {
  const buffer = Buffer.from(value, 'utf8');
  if (buffer.length <= maxBytes) {
    return value;
  }
  return buffer.subarray(0, maxBytes).toString('utf8');
};

const sanitizePayload = (payload: unknown) => {
  if (payload === undefined) {
    return null;
  }

  const maskObject = (input: unknown): unknown => {
    if (typeof input === 'string') {
      return maskSensitive(input);
    }
    if (Array.isArray(input)) {
      return input.map(maskObject);
    }
    if (input && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(([key, value]) => [
          key,
          maskObject(value),
        ])
      );
    }
    return input;
  };

  const masked = maskObject(payload);
  const serialized = JSON.stringify(masked);
  if (Buffer.byteLength(serialized, 'utf8') <= WEBHOOK_INTEGRATION_LIMITS.MAX_LOG_PAYLOAD_BYTES) {
    return masked;
  }

  const truncated = truncateBytes(
    maskSensitive(serialized),
    WEBHOOK_INTEGRATION_LIMITS.MAX_LOG_PAYLOAD_BYTES
  );
  return {
    truncated: true,
    preview: truncated,
    bytes: Buffer.byteLength(serialized, 'utf8'),
  };
};

const sanitizeText = (value: unknown, maxBytes: number) => {
  if (value === undefined || value === null) {
    return null;
  }
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  const masked = maskSensitive(stringValue);
  return truncateBytes(masked, maxBytes);
};

export async function createWebhookLog(
  botId: string,
  stateKey: string,
  userId: number,
  url: string,
  payload: unknown,
  status: number | null,
  response: unknown,
  error: string | null,
  retryCount: number
): Promise<void> {
  const client = await getPostgresClient();
  try {
    const sanitizedPayload = sanitizePayload(payload);
    const responseBody = sanitizeText(
      response,
      WEBHOOK_INTEGRATION_LIMITS.MAX_LOG_RESPONSE_BODY_BYTES
    );
    const errorMessage = sanitizeText(
      error,
      WEBHOOK_INTEGRATION_LIMITS.MAX_LOG_ERROR_MESSAGE_LENGTH
    );

    await client.query(
      `INSERT INTO webhook_logs (
        bot_id,
        state_key,
        telegram_user_id,
        webhook_url,
        request_payload,
        response_status,
        response_body,
        error_message,
        retry_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        botId,
        stateKey,
        userId,
        url,
        sanitizedPayload ? JSON.stringify(sanitizedPayload) : null,
        status,
        responseBody,
        errorMessage,
        retryCount,
      ]
    );
  } finally {
    client.release();
  }
}
