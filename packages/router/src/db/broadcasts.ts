import { getPostgresClient } from './postgres';

export async function findBroadcastMessageIdByTelegramMessage(
  botId: string,
  telegramUserId: number,
  telegramMessageId: number
): Promise<string | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT bm.id
       FROM broadcast_messages bm
       JOIN bot_broadcasts b ON b.id = bm.broadcast_id
       WHERE b.bot_id = $1
         AND bm.telegram_user_id = $2
         AND bm.telegram_message_id = $3
       LIMIT 1`,
      [botId, telegramUserId, telegramMessageId]
    );
    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

export async function findLatestSentBroadcastMessageId(
  botId: string,
  telegramUserId: number,
  sentAfter: Date
): Promise<string | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ id: string }>(
      `SELECT bm.id
       FROM broadcast_messages bm
       JOIN bot_broadcasts b ON b.id = bm.broadcast_id
       WHERE b.bot_id = $1
         AND bm.telegram_user_id = $2
         AND bm.status = 'sent'
         AND bm.sent_at >= $3
       ORDER BY bm.sent_at DESC
       LIMIT 1`,
      [botId, telegramUserId, sentAfter]
    );
    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

export async function incrementBroadcastMessageClicks(messageId: string): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query(
      `UPDATE broadcast_messages
       SET click_count = click_count + 1
       WHERE id = $1`,
      [messageId]
    );
  } finally {
    client.release();
  }
}

export async function markBroadcastMessageEngaged(messageId: string): Promise<boolean> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE broadcast_messages
       SET engaged_count = CASE WHEN engaged_count = 0 THEN 1 ELSE engaged_count END,
           last_engaged_at = CASE WHEN engaged_count = 0 THEN now() ELSE last_engaged_at END
       WHERE id = $1
       RETURNING engaged_count`,
      [messageId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}
