import { getPostgresClient } from './postgres';
import { WEBHOOK_INTEGRATION_LIMITS } from '@dialogue-constructor/shared';

export interface WebhookLog {
  id: string;
  bot_id: string;
  state_key: string;
  telegram_user_id: number;
  webhook_url: string;
  request_payload: unknown;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: Date;
}

export interface WebhookLogStatsRow {
  state_key: string;
  total: number;
  success_count: number;
  error_count: number;
  last_error: string | null;
}

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginatedWebhookLogs {
  logs: WebhookLog[];
  nextCursor: string | null;
  hasMore: boolean;
}

type LogCursor = { created_at: string; id: string };

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

function encodeCursor(cursor: LogCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
}

function decodeCursor(cursor?: string): LogCursor | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as LogCursor;
  } catch {
    return null;
  }
}

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

export async function getWebhookLogsByBotId(
  botId: string,
  params: CursorPaginationParams
): Promise<PaginatedWebhookLogs> {
  const client = await getPostgresClient();
  try {
    const limit = Math.min(Math.max(params.limit, 1), 100);
    const decoded = decodeCursor(params.cursor);
    const values: Array<string | number> = [botId, limit + 1];
    let where = 'WHERE bot_id = $1';

    if (decoded) {
      values.push(decoded.created_at, decoded.id);
      where += ' AND (created_at, id) < ($3, $4)';
    }

    const result = await client.query<WebhookLog>(
      `SELECT id, bot_id, state_key, telegram_user_id, webhook_url, request_payload,
              response_status, response_body, error_message, retry_count, created_at
       FROM webhook_logs
       ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      values
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const logs = hasMore ? rows.slice(0, limit) : rows;
    const last = logs[logs.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: String((last as any).created_at), id: String((last as any).id) })
        : null;

    return { logs, nextCursor, hasMore };
  } finally {
    client.release();
  }
}

export async function getWebhookStats(botId: string): Promise<WebhookLogStatsRow[]> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{
      state_key: string;
      total: string;
      success_count: string;
      error_count: string;
      last_error: string | null;
    }>(
      `SELECT state_key,
              COUNT(*) AS total,
              SUM(CASE WHEN response_status BETWEEN 200 AND 299 THEN 1 ELSE 0 END) AS success_count,
              SUM(CASE WHEN response_status IS NULL OR response_status >= 400 THEN 1 ELSE 0 END) AS error_count,
              MAX(CASE WHEN response_status IS NULL OR response_status >= 400 THEN error_message ELSE NULL END) AS last_error
       FROM webhook_logs
       WHERE bot_id = $1
       GROUP BY state_key
       ORDER BY state_key ASC`,
      [botId]
    );

    return result.rows.map((row) => ({
      state_key: row.state_key,
      total: Number(row.total) || 0,
      success_count: Number(row.success_count) || 0,
      error_count: Number(row.error_count) || 0,
      last_error: row.last_error,
    }));
  } finally {
    client.release();
  }
}
