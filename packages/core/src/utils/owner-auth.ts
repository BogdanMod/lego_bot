import crypto from 'crypto';

export type TelegramLoginPayload = {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
};

export type OwnerSessionClaims = {
  sub: number;
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
  csrf: string;
  iat: number;
  exp: number;
};

function toBase64Url(value: Buffer | string): string {
  const buf = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyTelegramLoginPayload(
  payload: TelegramLoginPayload,
  botToken: string,
  nowSec: number = Math.floor(Date.now() / 1000),
  maxAgeSec: number = 86400
): { valid: boolean; reason?: string; userId?: number } {
  const hash = payload.hash;
  if (!hash) return { valid: false, reason: 'missing_hash' };

  const authDate = Number(payload.auth_date);
  if (!Number.isFinite(authDate) || authDate <= 0) {
    return { valid: false, reason: 'invalid_auth_date' };
  }
  if (authDate > nowSec + 60) {
    return { valid: false, reason: 'auth_date_in_future' };
  }
  if (nowSec - authDate > maxAgeSec) {
    return { valid: false, reason: 'auth_date_expired' };
  }

  const entries = Object.entries(payload)
    .filter(([key, value]) => key !== 'hash' && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join('\n');

  const secret = crypto.createHash('sha256').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!safeEqual(calculated, hash)) {
    return { valid: false, reason: 'invalid_hash' };
  }

  const userId = Number(payload.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { valid: false, reason: 'invalid_user_id' };
  }
  return { valid: true, userId };
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function signOwnerSession(
  claims: Omit<OwnerSessionClaims, 'iat' | 'exp'> & { ttlSec: number },
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000)
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: OwnerSessionClaims = {
    sub: claims.sub,
    username: claims.username ?? null,
    first_name: claims.first_name ?? null,
    last_name: claims.last_name ?? null,
    photo_url: claims.photo_url ?? null,
    csrf: claims.csrf,
    iat: nowSec,
    exp: nowSec + claims.ttlSec,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = toBase64Url(crypto.createHmac('sha256', secret).update(data).digest());
  return `${data}.${signature}`;
}

export function verifyOwnerSession(token: string, secret: string, nowSec: number = Math.floor(Date.now() / 1000)): OwnerSessionClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = toBase64Url(crypto.createHmac('sha256', secret).update(data).digest());
  if (!safeEqual(expectedSignature, encodedSignature)) return null;
  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as OwnerSessionClaims;
    if (!payload?.sub || !payload?.csrf || !payload?.exp || !payload?.iat) return null;
    if (payload.exp <= nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, chunk) => {
    const idx = chunk.indexOf('=');
    if (idx <= 0) return acc;
    const key = chunk.slice(0, idx).trim();
    const value = chunk.slice(idx + 1).trim();
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

export function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAgeSec?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    path?: string;
  } = {}
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? '/'}`);
  if (typeof options.maxAgeSec === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSec))}`);
  }
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join('; ');
}

