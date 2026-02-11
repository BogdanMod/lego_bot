import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyTelegramLoginPayload, signOwnerSession, verifyOwnerSession } from '../utils/owner-auth';

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
});

