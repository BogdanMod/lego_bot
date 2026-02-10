import { getPostgresClient } from './postgres';

export type AdminStats = {
  totalUsers: number;
  activeUsersLast7d: number;
  joinedLast7d: number;
  joinedLast30d: number;
  activeSubscriptions: number;
};

export type PromoCode = {
  id: string;
  code: string;
  durationDays: number;
  maxRedemptions: number;
  redemptionCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type MaintenanceState = {
  enabled: boolean;
  message: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type PromoCodeCreateData = {
  code?: string | null;
  durationDays: number;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
  createdBy?: number | null;
};

export type PromoRedeemResult = {
  telegramUserId: string;
  promoCode: string;
  startsAt: string;
  endsAt: string | null;
  plan: string;
};

export async function getAdminStats(): Promise<AdminStats> {
  const client = await getPostgresClient();
  try {
    const usersResult = await client.query<{
      total_users: string;
      active_users_last_7d: string;
      joined_last_7d: string;
      joined_last_30d: string;
    }>(
      `
      WITH distinct_users AS (
        SELECT
          telegram_user_id,
          MIN(first_interaction_at) AS first_interaction_at,
          MAX(last_interaction_at) AS last_interaction_at
        FROM bot_users
        GROUP BY telegram_user_id
      )
      SELECT
        COUNT(*)::text AS total_users,
        COUNT(*) FILTER (WHERE last_interaction_at >= now() - interval '7 days')::text AS active_users_last_7d,
        COUNT(*) FILTER (WHERE first_interaction_at >= now() - interval '7 days')::text AS joined_last_7d,
        COUNT(*) FILTER (WHERE first_interaction_at >= now() - interval '30 days')::text AS joined_last_30d
      FROM distinct_users
      `
    );

    const subsResult = await client.query<{ active_subscriptions: string }>(
      `
      SELECT COUNT(*)::text AS active_subscriptions
      FROM user_subscriptions
      WHERE status = 'active'
        AND (ends_at IS NULL OR ends_at >= now())
      `
    );

    const usersRow = usersResult.rows[0] ?? {
      total_users: '0',
      active_users_last_7d: '0',
      joined_last_7d: '0',
      joined_last_30d: '0',
    };
    const subsRow = subsResult.rows[0] ?? { active_subscriptions: '0' };

    return {
      totalUsers: Number(usersRow.total_users || 0),
      activeUsersLast7d: Number(usersRow.active_users_last_7d || 0),
      joinedLast7d: Number(usersRow.joined_last_7d || 0),
      joinedLast30d: Number(usersRow.joined_last_30d || 0),
      activeSubscriptions: Number(subsRow.active_subscriptions || 0),
    };
  } finally {
    client.release();
  }
}

export async function listPromoCodes(): Promise<PromoCode[]> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{
      id: string;
      code: string;
      duration_days: number;
      max_redemptions: number;
      redemption_count: number;
      is_active: boolean;
      expires_at: string | null;
      created_by: string | null;
      created_at: string;
    }>(
      `
      SELECT
        id,
        code,
        duration_days,
        max_redemptions,
        redemption_count,
        is_active,
        expires_at,
        created_by::text as created_by,
        created_at
      FROM promo_codes
      ORDER BY created_at DESC
      `
    );
    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      durationDays: row.duration_days,
      maxRedemptions: row.max_redemptions,
      redemptionCount: row.redemption_count,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
    }));
  } finally {
    client.release();
  }
}

export async function createPromoCode(data: PromoCodeCreateData): Promise<PromoCode> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{
      id: string;
      code: string;
      duration_days: number;
      max_redemptions: number;
      redemption_count: number;
      is_active: boolean;
      expires_at: string | null;
      created_by: string | null;
      created_at: string;
    }>(
      `
      INSERT INTO promo_codes (code, duration_days, max_redemptions, expires_at, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        code,
        duration_days,
        max_redemptions,
        redemption_count,
        is_active,
        expires_at,
        created_by::text as created_by,
        created_at
      `,
      [
        data.code,
        data.durationDays,
        data.maxRedemptions ?? 1,
        data.expiresAt ?? null,
        data.createdBy ?? null,
      ]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      code: row.code,
      durationDays: row.duration_days,
      maxRedemptions: row.max_redemptions,
      redemptionCount: row.redemption_count,
      isActive: row.is_active,
      expiresAt: row.expires_at,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  } finally {
    client.release();
  }
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ value: any; updated_at: string }>(
      `
      SELECT value, updated_at
      FROM system_settings
      WHERE key = 'maintenance'
      LIMIT 1
      `
    );
    if (result.rows.length === 0) {
      return { enabled: false, message: null, updatedBy: null, updatedAt: null };
    }
    const row = result.rows[0];
    const value = row.value || {};
    return {
      enabled: Boolean(value.enabled),
      message: value.message ?? null,
      updatedBy: value.updatedBy ? String(value.updatedBy) : null,
      updatedAt: row.updated_at || null,
    };
  } finally {
    client.release();
  }
}

export async function setMaintenanceState(
  enabled: boolean,
  message: string | null,
  updatedBy: number | null
): Promise<MaintenanceState> {
  const client = await getPostgresClient();
  try {
    const payload = {
      enabled,
      message: message ?? null,
      updatedBy: updatedBy ?? null,
    };
    const result = await client.query<{ value: any; updated_at: string }>(
      `
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('maintenance', $1, now())
      ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = now()
      RETURNING value, updated_at
      `,
      [payload]
    );
    const row = result.rows[0];
    const value = row?.value || payload;
    return {
      enabled: Boolean(value.enabled),
      message: value.message ?? null,
      updatedBy: value.updatedBy ? String(value.updatedBy) : null,
      updatedAt: row?.updated_at || null,
    };
  } finally {
    client.release();
  }
}

export async function redeemPromoCode(
  telegramUserId: number,
  code: string
): Promise<PromoRedeemResult> {
  const client = await getPostgresClient();
  const now = new Date();
  try {
    await client.query('BEGIN');

    const promoResult = await client.query<{
      id: string;
      code: string;
      duration_days: number;
      max_redemptions: number;
      redemption_count: number;
      is_active: boolean;
      expires_at: string | null;
    }>(
      `
      SELECT id, code, duration_days, max_redemptions, redemption_count, is_active, expires_at
      FROM promo_codes
      WHERE code = $1
      FOR UPDATE
      `,
      [code]
    );

    if (promoResult.rows.length === 0) {
      throw new Error('Промокод не найден');
    }

    const promo = promoResult.rows[0];
    if (!promo.is_active) {
      throw new Error('Промокод не активен');
    }
    if (promo.expires_at && new Date(promo.expires_at).getTime() < now.getTime()) {
      throw new Error('Срок действия промокода истек');
    }
    if (promo.redemption_count >= promo.max_redemptions) {
      throw new Error('Достигнут лимит использований промокода');
    }

    const redemptionCheck = await client.query<{ id: string }>(
      `
      SELECT id
      FROM promo_code_redemptions
      WHERE promo_code_id = $1 AND telegram_user_id = $2
      LIMIT 1
      `,
      [promo.id, telegramUserId]
    );
    if (redemptionCheck.rows.length > 0) {
      throw new Error('Промокод уже использован этим пользователем');
    }

    const existingSub = await client.query<{ ends_at: string | null }>(
      `
      SELECT ends_at
      FROM user_subscriptions
      WHERE telegram_user_id = $1
      FOR UPDATE
      `,
      [telegramUserId]
    );

    const existingEndsAt = existingSub.rows[0]?.ends_at
      ? new Date(existingSub.rows[0].ends_at)
      : null;
    const baseDate =
      existingEndsAt && existingEndsAt.getTime() > now.getTime()
        ? existingEndsAt
        : now;
    const endsAt = new Date(baseDate.getTime() + promo.duration_days * 24 * 60 * 60 * 1000);

    await client.query(
      `
      INSERT INTO promo_code_redemptions (promo_code_id, telegram_user_id, subscription_ends_at)
      VALUES ($1, $2, $3)
      `,
      [promo.id, telegramUserId, endsAt.toISOString()]
    );

    await client.query(
      `
      UPDATE promo_codes
      SET redemption_count = redemption_count + 1
      WHERE id = $1
      `,
      [promo.id]
    );

    await client.query(
      `
      INSERT INTO user_subscriptions (telegram_user_id, status, plan, starts_at, ends_at, source, promo_code_id, updated_at)
      VALUES ($1, 'active', 'premium', now(), $2, 'promo', $3, now())
      ON CONFLICT (telegram_user_id) DO UPDATE
        SET status = 'active',
            plan = 'premium',
            ends_at = EXCLUDED.ends_at,
            source = 'promo',
            promo_code_id = EXCLUDED.promo_code_id,
            updated_at = now()
      `,
      [telegramUserId, endsAt.toISOString(), promo.id]
    );

    await client.query('COMMIT');

    return {
      telegramUserId: String(telegramUserId),
      promoCode: promo.code,
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      plan: 'premium',
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
