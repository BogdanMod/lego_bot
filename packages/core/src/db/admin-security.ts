/**
 * Admin Security - Production-grade admin user and secret management
 * 
 * Features:
 * - Admin users stored in DB (not ENV)
 * - Role-based permissions
 * - Rotating admin secrets
 * - Immutable audit logs with hash chain
 */

import { getPostgresClient, getPool } from './postgres';
import { createLogger } from '@dialogue-constructor/shared';
import * as crypto from 'crypto';
import { PoolClient } from 'pg';

const logger = createLogger('admin-security');

// Admin role permissions map
export const ADMIN_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  security_admin: ['admin:read', 'admin:maintenance', 'admin:secrets'],
  billing_admin: ['admin:billing', 'admin:read', 'admin:promo-codes'],
  support_admin: ['admin:read', 'admin:reset-user', 'admin:subscriptions'],
  read_only_admin: ['admin:read'],
} as const;

export type AdminRole = keyof typeof ADMIN_ROLE_PERMISSIONS;

export interface AdminUser {
  id: string;
  telegram_user_id: number;
  role: AdminRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AdminSecret {
  id: string;
  secret_hash: string;
  is_active: boolean;
  created_at: Date;
  expires_at: Date | null;
}

// Cache for admin users (TTL 60 seconds)
let adminUsersCache: Map<number, { user: AdminUser | null; expiresAt: number }> = new Map();
const ADMIN_CACHE_TTL_MS = 60_000;

/**
 * Check if permission is granted for role
 */
export function hasAdminPermission(role: AdminRole, permission: string): boolean {
  const permissions = ADMIN_ROLE_PERMISSIONS[role] || [];
  if (permissions.includes('*')) {
    return true;
  }
  return permissions.includes(permission);
}

/**
 * Get admin user by telegram_user_id (with caching)
 */
export async function getAdminUserByTelegramId(telegramUserId: number): Promise<AdminUser | null> {
  const now = Date.now();
  const cached = adminUsersCache.get(telegramUserId);
  
  if (cached && cached.expiresAt > now) {
    return cached.user;
  }
  
  const client = await getPostgresClient();
  try {
    const result = await client.query<AdminUser>(
      `SELECT id, telegram_user_id, role, is_active, created_at, updated_at
       FROM admin_users
       WHERE telegram_user_id = $1 AND is_active = true`,
      [telegramUserId]
    );
    
    const user = result.rows[0] || null;
    adminUsersCache.set(telegramUserId, {
      user,
      expiresAt: now + ADMIN_CACHE_TTL_MS,
    });
    
    return user;
  } finally {
    client.release();
  }
}

/**
 * Hash admin secret (SHA256 with salt)
 */
export function hashAdminSecret(secret: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(secret + actualSalt)
    .digest('hex');
  return { hash, salt: actualSalt };
}

/**
 * Verify admin secret
 */
export function verifyAdminSecret(secret: string, hash: string, salt: string): boolean {
  const computed = crypto
    .createHash('sha256')
    .update(secret + salt)
    .digest('hex');
  return timingSafeEqual(computed, hash);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Get active admin secrets
 */
export async function getActiveAdminSecrets(): Promise<AdminSecret[]> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<AdminSecret>(
      `SELECT id, secret_hash, is_active, created_at, expires_at
       FROM admin_secrets
       WHERE is_active = true
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      []
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Verify provided secret against active secrets
 */
export async function verifyAdminSecretFromDB(providedSecret: string): Promise<boolean> {
  const secrets = await getActiveAdminSecrets();
  
  for (const secretRecord of secrets) {
    // Extract salt from hash (format: salt:hash)
    const parts = secretRecord.secret_hash.split(':');
    if (parts.length !== 2) {
      logger.warn({ secretId: secretRecord.id }, 'Invalid secret hash format');
      continue;
    }
    
    const [salt, hash] = parts;
    if (verifyAdminSecret(providedSecret, hash, salt)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Create new admin secret
 */
export async function createAdminSecret(secret: string, expiresAt?: Date): Promise<AdminSecret> {
  const client = await getPostgresClient();
  try {
    const { hash, salt } = hashAdminSecret(secret);
    // Store as salt:hash
    const secretHash = `${salt}:${hash}`;
    
    const result = await client.query<AdminSecret>(
      `INSERT INTO admin_secrets (secret_hash, is_active, expires_at)
       VALUES ($1, true, $2)
       RETURNING id, secret_hash, is_active, created_at, expires_at`,
      [secretHash, expiresAt || null]
    );
    
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * Rotate admin secret (create new, deactivate old after grace period)
 */
export async function rotateAdminSecret(newSecret: string, gracePeriodHours: number = 24): Promise<{ newSecretId: string; deactivatedCount: number }> {
  const client = await getPostgresClient();
  try {
    await client.query('BEGIN');
    
    // Create new secret
    const newSecretRecord = await createAdminSecret(newSecret);
    
    // Deactivate old secrets after grace period
    const gracePeriodDate = new Date();
    gracePeriodDate.setHours(gracePeriodDate.getHours() + gracePeriodHours);
    
    const deactivateResult = await client.query(
      `UPDATE admin_secrets
       SET is_active = false
       WHERE is_active = true
         AND id != $1
         AND created_at < NOW() - INTERVAL '${gracePeriodHours} hours'`,
      [newSecretRecord.id]
    );
    
    await client.query('COMMIT');
    
    return {
      newSecretId: newSecretRecord.id,
      deactivatedCount: deactivateResult.rowCount || 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get last audit log entry hash for hash chain
 */
export async function getLastAuditLogHash(): Promise<string | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ entry_hash: string }>(
      `SELECT entry_hash
       FROM audit_logs
       ORDER BY created_at DESC
       LIMIT 1`,
      []
    );
    return result.rows[0]?.entry_hash || null;
  } finally {
    client.release();
  }
}

/**
 * Log security event (attempts to modify audit logs, etc.)
 */
export async function logSecurityEvent(
  eventType: string,
  metadata: Record<string, unknown>,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query(
      `INSERT INTO security_events (event_type, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [
        eventType,
        JSON.stringify(metadata),
        ipAddress || null,
        userAgent || null,
      ]
    );
  } finally {
    client.release();
  }
}

/**
 * Clear admin users cache
 */
export function clearAdminUsersCache(): void {
  adminUsersCache.clear();
}

