import { getPostgresClient } from './postgres';
import { MediaContent } from '@dialogue-constructor/shared';

export type BroadcastStatus =
  | 'draft'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BroadcastMessageStatus = 'pending' | 'sending' | 'sent' | 'failed';

export interface Broadcast {
  id: string;
  bot_id: string;
  name: string;
  message: string;
  media: MediaContent | null;
  parse_mode: 'HTML' | 'Markdown' | 'MarkdownV2' | null;
  status: BroadcastStatus;
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface BroadcastMessage {
  id: string;
  broadcast_id: string;
  telegram_user_id: number;
  status: BroadcastMessageStatus;
  sent_at: Date | null;
  sending_started_at: Date | null;
  telegram_message_id: number | null;
  error_message: string | null;
  retry_count: number;
  click_count: number;
  engaged_count: number;
  last_engaged_at: Date | null;
  created_at: Date;
}

export interface CreateBroadcastData {
  name: string;
  message: string;
  media?: MediaContent;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  scheduledAt?: string;
  totalRecipients?: number;
}

export interface CursorPaginationParams {
  limit: number;
  cursor?: string;
}

export interface PaginatedBroadcasts {
  broadcasts: Broadcast[];
  nextCursor: string | null;
  hasMore: boolean;
}

type BroadcastCursor = { created_at: string; id: string };

function encodeCursor(cursor: BroadcastCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64');
}

function decodeCursor(cursor?: string): BroadcastCursor | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as BroadcastCursor;
  } catch {
    return null;
  }
}

async function ensureBotOwnership(client: any, botId: string, userId: number): Promise<void> {
  const result = await client.query(
    `SELECT 1 FROM bots WHERE id = $1 AND user_id = $2`,
    [botId, userId]
  );
  if (result.rows.length === 0) {
    throw new Error('Bot not found');
  }
}

export async function createBroadcast(
  botId: string,
  userId: number,
  data: CreateBroadcastData
): Promise<Broadcast> {
  const client = await getPostgresClient();
  try {
    await ensureBotOwnership(client, botId, userId);

    const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    const status: BroadcastStatus = scheduledAt ? 'scheduled' : 'draft';
    const result = await client.query<Broadcast>(
      `INSERT INTO bot_broadcasts (
        bot_id,
        name,
        message,
        media,
        parse_mode,
        status,
        scheduled_at,
        total_recipients
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        botId,
        data.name,
        data.message,
        data.media ? JSON.stringify(data.media) : null,
        data.parseMode ?? 'HTML',
        status,
        scheduledAt,
        data.totalRecipients ?? 0,
      ]
    );

    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getBroadcastById(
  broadcastId: string,
  userId: number | null
): Promise<Broadcast | null> {
  const client = await getPostgresClient();
  try {
    const params: Array<string | number> = [broadcastId];
    let query = `SELECT b.* FROM bot_broadcasts b`;
    if (userId !== null) {
      params.push(userId);
      query += ` JOIN bots bot ON bot.id = b.bot_id AND bot.user_id = $2`;
    }
    query += ` WHERE b.id = $1`;

    const result = await client.query<Broadcast>(query, params);
    return result.rows[0] || null;
  } finally {
    client.release();
  }
}

export async function getBroadcastsByBotId(
  botId: string,
  userId: number,
  pagination: CursorPaginationParams
): Promise<PaginatedBroadcasts> {
  const client = await getPostgresClient();
  try {
    const limit = Math.min(Math.max(pagination.limit, 1), 100);
    const decoded = decodeCursor(pagination.cursor);

    const values: Array<string | number> = [botId, userId, limit + 1];
    let where = 'WHERE b.bot_id = $1';

    if (decoded) {
      values.push(decoded.created_at, decoded.id);
      where += ` AND (b.created_at, b.id) < ($4, $5)`;
    }

    const result = await client.query<Broadcast>(
      `SELECT b.*
       FROM bot_broadcasts b
       JOIN bots bot ON bot.id = b.bot_id AND bot.user_id = $2
       ${where}
       ORDER BY b.created_at DESC, b.id DESC
       LIMIT $3`,
      values
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const broadcasts = hasMore ? rows.slice(0, limit) : rows;

    const last = broadcasts[broadcasts.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: String((last as any).created_at), id: String((last as any).id) })
        : null;

    return { broadcasts, nextCursor, hasMore };
  } finally {
    client.release();
  }
}

export async function updateBroadcast(
  broadcastId: string,
  patch: Partial<Broadcast>
): Promise<void> {
  const client = await getPostgresClient();
  try {
    const fields: string[] = [];
    const values: Array<string | number | Date | null> = [];
    let index = 1;

    for (const [key, value] of Object.entries(patch)) {
      fields.push(`${key} = $${index}`);
      if (key === 'media' && value) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value as any);
      }
      index += 1;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(broadcastId);

    await client.query(
      `UPDATE bot_broadcasts SET ${fields.join(', ')} WHERE id = $${index}`,
      values
    );
  } finally {
    client.release();
  }
}

export async function scheduleBroadcast(
  broadcastId: string,
  scheduledAt: string
): Promise<void> {
  await updateBroadcast(broadcastId, {
    status: 'scheduled',
    scheduled_at: new Date(scheduledAt),
  } as Partial<Broadcast>);
}

export async function cancelBroadcast(broadcastId: string, userId: number): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query(
      `UPDATE bot_broadcasts b
       SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
       FROM bots bot
       WHERE b.id = $1
         AND b.status IN ('draft', 'scheduled')
         AND bot.id = b.bot_id
         AND bot.user_id = $2`,
      [broadcastId, userId]
    );
  } finally {
    client.release();
  }
}

export async function getBroadcastStats(broadcastId: string): Promise<{
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  clicks: number;
  engaged: number;
  progress: number;
}> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{
      total: string;
      pending: string;
      sending: string;
      sent: string;
      failed: string;
      clicks: string;
      engaged: string;
    }>(
      `SELECT
        COUNT(*)::text as total,
        COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
        COUNT(*) FILTER (WHERE status = 'sending')::text as sending,
        COUNT(*) FILTER (WHERE status = 'sent')::text as sent,
        COUNT(*) FILTER (WHERE status = 'failed')::text as failed,
        COALESCE(SUM(click_count), 0)::text as clicks,
        COALESCE(SUM(engaged_count), 0)::text as engaged
       FROM broadcast_messages
       WHERE broadcast_id = $1`,
      [broadcastId]
    );

    const row = result.rows[0];
    const total = Number(row?.total ?? 0);
    const sent = Number(row?.sent ?? 0);
    const failed = Number(row?.failed ?? 0);
    const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;

    return {
      total,
      pending: Number(row?.pending ?? 0),
      sending: Number(row?.sending ?? 0),
      sent,
      failed,
      clicks: Number(row?.clicks ?? 0),
      engaged: Number(row?.engaged ?? 0),
      progress,
    };
  } finally {
    client.release();
  }
}

export async function createBroadcastMessages(
  broadcastId: string,
  userIds: Array<string | number>
): Promise<void> {
  const client = await getPostgresClient();
  try {
    const batchSize = 1000;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const values: Array<string | number> = [];
      const rows = batch.map((userId, index) => {
        const offset = index * 2;
        values.push(broadcastId, userId);
        return `($${offset + 1}, $${offset + 2}::bigint)`;
      });

      await client.query(
        `INSERT INTO broadcast_messages (broadcast_id, telegram_user_id)
         VALUES ${rows.join(', ')}
         ON CONFLICT (broadcast_id, telegram_user_id) DO NOTHING`,
        values
      );
    }
  } finally {
    client.release();
  }
}

export async function getNextPendingMessages(
  broadcastId: string,
  limit: number
): Promise<BroadcastMessage[]> {
  const client = await getPostgresClient();
  try {
    await client.query('BEGIN');
    const result = await client.query<BroadcastMessage>(
      `WITH claimed AS (
        SELECT id
        FROM broadcast_messages
        WHERE broadcast_id = $1
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE broadcast_messages bm
      SET status = 'sending',
          sending_started_at = now()
      FROM claimed
      WHERE bm.id = claimed.id
      RETURNING bm.*`,
      [broadcastId, limit]
    );
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMessageStatus(
  messageId: string,
  status: BroadcastMessageStatus,
  error?: string,
  telegramMessageId?: number
): Promise<void> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ broadcast_id: string }>(
      `UPDATE broadcast_messages
       SET status = $2,
           sent_at = CASE WHEN $2 = 'sent' THEN now() ELSE sent_at END,
           telegram_message_id = CASE
             WHEN $2 = 'sent' THEN COALESCE($4, telegram_message_id)
             ELSE telegram_message_id
           END,
           error_message = $3,
           sending_started_at = CASE WHEN $2 = 'sending' THEN now() ELSE NULL END
       WHERE id = $1 AND status <> $2
       RETURNING broadcast_id`,
      [messageId, status, error ?? null, telegramMessageId ?? null]
    );

    if (result.rows.length > 0) {
      const broadcastId = result.rows[0].broadcast_id;
      if (status === 'sent') {
        await client.query(
          `UPDATE bot_broadcasts
           SET sent_count = sent_count + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [broadcastId]
        );
      }
      if (status === 'failed') {
        await client.query(
          `UPDATE bot_broadcasts
           SET failed_count = failed_count + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [broadcastId]
        );
      }
    }
  } finally {
    client.release();
  }
}

export async function resetStaleSendingMessages(
  broadcastId: string,
  staleBefore: Date
): Promise<number> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE broadcast_messages
       SET status = 'pending',
           sending_started_at = NULL,
           error_message = NULL
       WHERE broadcast_id = $1
         AND status = 'sending'
         AND (sending_started_at IS NULL OR sending_started_at < $2)`,
      [broadcastId, staleBefore]
    );
    return result.rowCount ?? 0;
  } finally {
    client.release();
  }
}

export async function getProcessingBroadcasts(limit = 50): Promise<Array<{ id: string }>> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT b.id
       FROM bot_broadcasts b
       WHERE b.status = 'processing'
         AND EXISTS (
           SELECT 1
           FROM broadcast_messages bm
           WHERE bm.broadcast_id = b.id
             AND bm.status IN ('pending', 'sending')
         )
       ORDER BY b.updated_at ASC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getScheduledBroadcasts(now: Date): Promise<Broadcast[]> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<Broadcast>(
      `SELECT *
       FROM bot_broadcasts
       WHERE status = 'scheduled' AND scheduled_at <= $1
       ORDER BY scheduled_at ASC`,
      [now]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
