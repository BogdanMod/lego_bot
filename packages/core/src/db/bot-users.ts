import {
  BotUser,
  BotUserStats,
  BotUserUpsertData,
  CursorPaginationParams,
  PaginatedBotUsers,
  createOrUpdateBotUserWithClient,
  exportBotUsersToCSVWithClient,
  getBotUserStatsWithClient,
  getBotUsersWithClient,
} from '@dialogue-constructor/shared';
import { getPostgresClient } from './postgres';

export type { BotUser, BotUserStats, BotUserUpsertData, CursorPaginationParams, PaginatedBotUsers };

export async function createOrUpdateBotUser(
  botId: string,
  telegramUserId: string,
  data: BotUserUpsertData
): Promise<BotUser> {
  const client = await getPostgresClient();
  try {
    return await createOrUpdateBotUserWithClient(client, botId, telegramUserId, data);
  } finally {
    client.release();
  }
}

export async function getBotUsers(
  botId: string,
  userId: number,
  pagination: CursorPaginationParams
): Promise<PaginatedBotUsers> {
  const client = await getPostgresClient();
  try {
    return await getBotUsersWithClient(client, botId, userId, pagination);
  } finally {
    client.release();
  }
}

export async function getBotUserStats(
  botId: string,
  userId: number
): Promise<BotUserStats> {
  const client = await getPostgresClient();
  try {
    return await getBotUserStatsWithClient(client, botId, userId);
  } finally {
    client.release();
  }
}

export async function exportBotUsersToCSV(
  botId: string,
  userId: number
): Promise<string> {
  const client = await getPostgresClient();
  try {
    return await exportBotUsersToCSVWithClient(client, botId, userId);
  } finally {
    client.release();
  }
}

export async function getBotTelegramUserIds(
  botId: string,
  ownerUserId: number
): Promise<string[]> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ telegram_user_id: string }>(
      `SELECT bu.telegram_user_id::text as telegram_user_id
       FROM bot_users bu
       JOIN bots b ON b.id = bu.bot_id AND b.user_id = $2
       WHERE bu.bot_id = $1`,
      [botId, ownerUserId]
    );
    return result.rows.map((row) => row.telegram_user_id);
  } finally {
    client.release();
  }
}
