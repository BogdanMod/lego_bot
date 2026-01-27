import type { Logger } from '@dialogue-constructor/shared';
import { BotUser, BotUserUpsertData, createOrUpdateBotUserWithClient } from '@dialogue-constructor/shared';
import { getPostgresClient } from './postgres';

export async function createOrUpdateBotUser(
  botId: string,
  telegramUserId: string,
  data: BotUserUpsertData,
  logger?: Logger
): Promise<BotUser | null> {
  const client = await getPostgresClient();
  try {
    return await createOrUpdateBotUserWithClient(client, botId, telegramUserId, data);
  } catch (error) {
    logger?.warn({ botId, telegramUserId, error }, 'Failed to upsert bot user');
    return null;
  } finally {
    client.release();
  }
}

export async function getBotUserProfile(
  botId: string,
  telegramUserId: number,
  logger?: Logger
): Promise<{
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone_number: string | null;
  email: string | null;
  language_code: string | null;
} | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{
      first_name: string | null;
      last_name: string | null;
      username: string | null;
      phone_number: string | null;
      email: string | null;
      language_code: string | null;
    }>(
      `SELECT first_name, last_name, username, phone_number, email, language_code
       FROM bot_users
       WHERE bot_id = $1 AND telegram_user_id = $2
       LIMIT 1`,
      [botId, telegramUserId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger?.warn({ botId, telegramUserId, error }, 'Failed to get bot user profile');
    return null;
  } finally {
    client.release();
  }
}
