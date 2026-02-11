import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  createOwnerBotlinkToken,
  signOwnerSession,
  verifyOwnerBotlinkToken,
  verifyOwnerSession,
  verifyTelegramLoginPayload,
} from '../utils/owner-auth';

function makePayload(botToken: string) {
  const payload: any = {
    id: 123456789,
    first_name: 'Bogdan',
    username: 'bogdan',
    auth_date: Math.floor(Date.now() / 1000),
  };
  const dataCheckString = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHash('sha256').update(botToken).digest();
  payload.hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return payload;
}

describe('owner auth utils', () => {
  it('verifies valid telegram login payload', () => {
    const botToken = '12345:test-token';
    const payload = makePayload(botToken);
    const result = verifyTelegramLoginPayload(payload, botToken);
    expect(result.valid).toBe(true);
    expect(result.userId).toBe(123456789);
  });

  it('rejects invalid telegram payload hash', () => {
    const botToken = '12345:test-token';
    const payload = makePayload(botToken);
    payload.hash = 'invalid';
    const result = verifyTelegramLoginPayload(payload, botToken);
    expect(result.valid).toBe(false);
  });

  it('signs and verifies owner session token', () => {
    const token = signOwnerSession(
      {
        sub: 123,
        csrf: 'csrf-token',
        ttlSec: 60,
      },
      'secret'
    );
    const claims = verifyOwnerSession(token, 'secret');
    expect(claims?.sub).toBe(123);
    expect(claims?.csrf).toBe('csrf-token');
  });

  it('creates and verifies owner botlink token', () => {
    const token = createOwnerBotlinkToken(
      {
        telegramUserId: 12345,
        jti: 'jti-1',
        ttlSec: 120,
      },
      'botlink-secret',
      1_700_000_000
    );
    const verified = verifyOwnerBotlinkToken(token, 'botlink-secret', 1_700_000_030);
    expect(verified.valid).toBe(true);
    expect(verified.telegramUserId).toBe(12345);
    expect(verified.jti).toBe('jti-1');
  });

  it('rejects expired owner botlink token', () => {
    const token = createOwnerBotlinkToken(
      {
        telegramUserId: 12345,
        jti: 'jti-2',
        ttlSec: 60,
      },
      'botlink-secret',
      1_700_000_000
    );
    const verified = verifyOwnerBotlinkToken(token, 'botlink-secret', 1_700_000_061);
    expect(verified.valid).toBe(false);
    expect(verified.reason).toBe('expired');
  });
});

