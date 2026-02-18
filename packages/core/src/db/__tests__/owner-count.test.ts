import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPostgresClient } from '../postgres';
import { getOwnerAccessibleBots, countOwnerAccessibleBots } from '../owner';
import { createBot } from '../bots';
import { upsertBotTeamMember } from '../owner';

describe('Owner Bot Count (RBAC)', () => {
  let testUserId: number;
  let botId1: string;
  let botId2: string;
  let botId3: string;

  beforeAll(async () => {
    testUserId = 999999; // Test user ID
    
    // Create test bots
    const bot1 = await createBot({
      user_id: testUserId,
      token: 'test_token_1',
      name: 'Test Bot 1',
    }, { requestId: 'test' });
    botId1 = bot1.id;

    const bot2 = await createBot({
      user_id: testUserId,
      token: 'test_token_2',
      name: 'Test Bot 2',
    }, { requestId: 'test' });
    botId2 = bot2.id;

    const bot3 = await createBot({
      user_id: testUserId,
      token: 'test_token_3',
      name: 'Test Bot 3',
    }, { requestId: 'test' });
    botId3 = bot3.id;

    // Add user as owner to all bots
    await upsertBotTeamMember({
      botId: botId1,
      telegramUserId: testUserId,
      role: 'owner',
      actorUserId: testUserId,
    });
    await upsertBotTeamMember({
      botId: botId2,
      telegramUserId: testUserId,
      role: 'owner',
      actorUserId: testUserId,
    });
    await upsertBotTeamMember({
      botId: botId3,
      telegramUserId: testUserId,
      role: 'owner',
      actorUserId: testUserId,
    });
  });

  afterAll(async () => {
    const client = await getPostgresClient();
    try {
      // Clean up test data
      await client.query('DELETE FROM bot_admins WHERE telegram_user_id = $1', [testUserId]);
      await client.query('DELETE FROM bots WHERE user_id = $1', [testUserId]);
    } finally {
      client.release();
    }
  });

  it('should return correct count of accessible bots', async () => {
    const count = await countOwnerAccessibleBots(testUserId);
    expect(count).toBe(3);
  });

  it('should return accessible bots without duplicates', async () => {
    const bots = await getOwnerAccessibleBots(testUserId);
    expect(bots.length).toBe(3);
    
    // Check for duplicates
    const botIds = bots.map(b => b.botId);
    const uniqueBotIds = new Set(botIds);
    expect(uniqueBotIds.size).toBe(3);
  });

  it('should match count function with accessible bots length', async () => {
    const count = await countOwnerAccessibleBots(testUserId);
    const bots = await getOwnerAccessibleBots(testUserId);
    
    expect(count).toBe(bots.length);
  });

  it('should exclude inactive bots from count', async () => {
    const client = await getPostgresClient();
    try {
      // Deactivate one bot
      await client.query('UPDATE bots SET is_active = false WHERE id = $1', [botId1]);
      
      const count = await countOwnerAccessibleBots(testUserId);
      expect(count).toBe(2);
      
      const bots = await getOwnerAccessibleBots(testUserId);
      expect(bots.length).toBe(2);
      expect(bots.every(b => b.botId !== botId1)).toBe(true);
      
      // Reactivate
      await client.query('UPDATE bots SET is_active = true WHERE id = $1', [botId1]);
    } finally {
      client.release();
    }
  });

  it('should exclude deleted bots from count', async () => {
    const client = await getPostgresClient();
    try {
      // Soft delete one bot
      await client.query('UPDATE bots SET deleted_at = now() WHERE id = $1', [botId2]);
      
      const count = await countOwnerAccessibleBots(testUserId);
      expect(count).toBe(2);
      
      const bots = await getOwnerAccessibleBots(testUserId);
      expect(bots.length).toBe(2);
      expect(bots.every(b => b.botId !== botId2)).toBe(true);
      
      // Restore
      await client.query('UPDATE bots SET deleted_at = NULL WHERE id = $1', [botId2]);
    } finally {
      client.release();
    }
  });
});

