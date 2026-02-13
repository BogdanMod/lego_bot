import { getPostgresClient } from './postgres';
import { getLastAuditLogHash } from './admin-security';
import * as crypto from 'crypto';

export type AuditLogParams = {
  userId: number;
  requestId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: unknown;
  ipAddress?: string;
  userAgent?: string;
};

function limitMetadataSize(metadata: unknown): unknown | null {
  if (metadata === undefined) {
    return null;
  }
  const serialized = JSON.stringify(metadata);
  if (serialized.length > 4096) {
    return { truncated: true };
  }
  return metadata;
}

/**
 * Calculate entry hash for hash chain
 */
function calculateEntryHash(prevHash: string | null, payload: Record<string, unknown>): string {
  const payloadStr = JSON.stringify(payload);
  const data = (prevHash || '') + payloadStr;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Log audit event with immutable hash chain
 */
export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  const client = await getPostgresClient();
  try {
    const metadata = limitMetadataSize(params.metadata);
    
    // Get previous hash for chain
    const prevHash = await getLastAuditLogHash();
    
    // Build payload for hash calculation
    const payload = {
      userId: params.userId,
      requestId: params.requestId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      metadata,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      timestamp: new Date().toISOString(),
    };
    
    // Calculate entry hash
    const entryHash = calculateEntryHash(prevHash, payload);
    
    // Insert with hash chain
    await client.query(
      `INSERT INTO audit_logs (user_id, request_id, action, resource_type, resource_id, metadata, ip_address, user_agent, prev_hash, entry_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.userId,
        params.requestId ?? null,
        params.action,
        params.resourceType,
        params.resourceId ?? null,
        metadata,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        prevHash,
        entryHash,
      ]
    );
  } finally {
    client.release();
  }
}
