import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'crypto';
import { createBot } from '../bots';
import { getPostgresClient } from '../postgres';
import {
  createBroadcast,
  createBroadcastMessages,
  getBroadcastById,
  getBroadcastsByBotId,
  getNextPendingMessages,
  updateBroadcast,
} from '../broadcasts';

const TEST_RUN_ID = crypto.randomUUID();
const USER_ID_BASE = Number.parseInt(TEST_RUN_ID.replace(/-/g, '').slice(0, 10), 16);

let userIdCounter = 0;
let currentUserId = USER_ID_BASE;
const createdBotIds: string[] = [];
const createdBroadcastIds: string[] = [];

async function cleanupDatabase(userId: number, botIds: string[], broadcastIds: string[]): Promise<void> {
  const client = await getPostgresClient();
  try {
    if (broadcastIds.length > 0) {
      await client.query('DELETE FROM broadcast_messages WHERE broadcast_id = ANY($1::uuid[])', [broadcastIds]);
      await client.query('DELETE FROM bot_broadcasts WHERE id = ANY($1::uuid[])', [broadcastIds]);
    }
    if (botIds.length > 0) {
      await client.query('DELETE FROM bot_broadcasts WHERE bot_id = ANY($1::uuid[])', [botIds]);
    }
    await client.query('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM bots WHERE user_id = $1', [userId]);
  } finally {
    client.release();
  }
}

async function createTestBot(token: string, name: string) {
  const bot = await createBot({ user_id: currentUserId, token, name });
  createdBotIds.push(bot.id);
  return bot;
}

beforeEach(async () => {
  currentUserId = USER_ID_BASE + userIdCounter;
  userIdCounter += 1;
  createdBotIds.length = 0;
  createdBroadcastIds.length = 0;
});

afterEach(async () => {
  await cleanupDatabase(currentUserId, createdBotIds, createdBroadcastIds);
});

describe('broadcasts CRUD operations', () => {
  it('creates broadcast', async () => {
    const bot = await createTestBot('token', 'Bot');
    const broadcast = await createBroadcast(bot.id, currentUserId, {
      name: 'Test Broadcast',
      message: 'Hello',
      totalRecipients: 2,
    });
    createdBroadcastIds.push(broadcast.id);

    expect(broadcast.id).toBeTruthy();
    expect(broadcast.bot_id).toBe(bot.id);
    expect(broadcast.name).toBe('Test Broadcast');
    expect(broadcast.status).toBe('draft');
    expect(broadcast.total_recipients).toBe(2);
  });

  it('returns paginated broadcasts', async () => {
    const bot = await createTestBot('token', 'Bot');

    const first = await createBroadcast(bot.id, currentUserId, {
      name: 'Broadcast 1',
      message: 'Hello 1',
    });
    const second = await createBroadcast(bot.id, currentUserId, {
      name: 'Broadcast 2',
      message: 'Hello 2',
    });
    createdBroadcastIds.push(first.id, second.id);

    const result = await getBroadcastsByBotId(bot.id, currentUserId, { limit: 1 });

    expect(result.broadcasts).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
  });

  it('updates broadcast status', async () => {
    const bot = await createTestBot('token', 'Bot');
    const broadcast = await createBroadcast(bot.id, currentUserId, {
      name: 'Broadcast',
      message: 'Hello',
    });
    createdBroadcastIds.push(broadcast.id);

    await updateBroadcast(broadcast.id, { status: 'processing' });
    const updated = await getBroadcastById(broadcast.id, currentUserId);

    expect(updated?.status).toBe('processing');
  });

  it('creates broadcast messages and returns pending messages', async () => {
    const bot = await createTestBot('token', 'Bot');
    const broadcast = await createBroadcast(bot.id, currentUserId, {
      name: 'Broadcast',
      message: 'Hello',
    });
    createdBroadcastIds.push(broadcast.id);

    await createBroadcastMessages(broadcast.id, ['1001', '1002', '1003']);
    const pending = await getNextPendingMessages(broadcast.id, 2);

    expect(pending).toHaveLength(2);
    expect(pending.every((message) => message.status === 'sending')).toBe(true);
  });
});
