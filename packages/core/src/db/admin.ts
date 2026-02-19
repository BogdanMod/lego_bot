import { getPostgresClient } from './postgres';

export type AdminStats = {
  totalUsers: number;
  activeUsersLast7d: number;
  joinedLast7d: number;
  joinedLast30d: number;
  activeSubscriptions: number;
  retentionDay1: number;
  retentionDay7: number;
  retentionDay30: number;
  conversionToPaid: number;
  arpuUsd30d: number;
  estimatedRevenueUsd30d: number;
  paidSubscriptions: number;
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

export type AdminGrantSubscriptionData = {
  telegramUserId: number;
  durationDays: number;
  plan?: string | null;
  adminUserId?: number | null;
};

export type AdminGrantSubscriptionResult = {
  telegramUserId: string;
  startsAt: string;
  endsAt: string | null;
  plan: string;
  source: string;
  grantedBy: string | null;
};

export async function getAdminStats(): Promise<AdminStats> {
  const client = await getPostgresClient();
  const monthlyPriceUsd = Number(process.env.PREMIUM_MONTHLY_PRICE_USD ?? 10);
  try {
    const usersResult = await client.query<{
      total_users: string;
      active_users_last_7d: string;
      joined_last_7d: string;
      joined_last_30d: string;
      retention_day_1_pct: string;
      retention_day_7_pct: string;
      retention_day_30_pct: string;
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
        COUNT(*) FILTER (WHERE first_interaction_at >= now() - interval '30 days')::text AS joined_last_30d,
        COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (
                WHERE first_interaction_at <= now() - interval '1 day'
                  AND last_interaction_at >= first_interaction_at + interval '1 day'
              )::numeric
              / NULLIF(COUNT(*) FILTER (WHERE first_interaction_at <= now() - interval '1 day'), 0)
            ) * 100,
            2
          ),
          0
        )::text AS retention_day_1_pct,
        COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (
                WHERE first_interaction_at <= now() - interval '7 days'
                  AND last_interaction_at >= first_interaction_at + interval '7 days'
              )::numeric
              / NULLIF(COUNT(*) FILTER (WHERE first_interaction_at <= now() - interval '7 days'), 0)
            ) * 100,
            2
          ),
          0
        )::text AS retention_day_7_pct,
        COALESCE(
          ROUND(
            (
              COUNT(*) FILTER (
                WHERE first_interaction_at <= now() - interval '30 days'
                  AND last_interaction_at >= first_interaction_at + interval '30 days'
              )::numeric
              / NULLIF(COUNT(*) FILTER (WHERE first_interaction_at <= now() - interval '30 days'), 0)
            ) * 100,
            2
          ),
          0
        )::text AS retention_day_30_pct
      FROM distinct_users
      `
    );

    const subsResult = await client.query<{
      active_subscriptions: string;
      paid_subscriptions: string;
      conversion_to_paid_pct: string;
      estimated_revenue_usd_30d: string;
      arpu_usd_30d: string;
    }>(
      `
      WITH users AS (
        SELECT COUNT(DISTINCT telegram_user_id)::numeric AS total_users
        FROM bot_users
      ),
      active_subs AS (
        SELECT
          COUNT(*)::numeric AS active_subscriptions,
          COUNT(*) FILTER (
            WHERE source IS NULL
              OR (source <> 'promo' AND source <> 'manual_admin')
          )::numeric AS paid_subscriptions
        FROM user_subscriptions
        WHERE status = 'active'
          AND (ends_at IS NULL OR ends_at >= now())
      )
      SELECT
        active_subscriptions::text AS active_subscriptions,
        paid_subscriptions::text AS paid_subscriptions,
        COALESCE(
          ROUND((paid_subscriptions / NULLIF(users.total_users, 0)) * 100, 2),
          0
        )::text AS conversion_to_paid_pct,
        ROUND((paid_subscriptions * $1)::numeric, 2)::text AS estimated_revenue_usd_30d,
        COALESCE(
          ROUND(((paid_subscriptions * $1) / NULLIF(users.total_users, 0))::numeric, 4),
          0
        )::text AS arpu_usd_30d
      FROM active_subs, users
      `,
      [monthlyPriceUsd]
    );

    const usersRow = usersResult.rows[0] ?? {
      total_users: '0',
      active_users_last_7d: '0',
      joined_last_7d: '0',
      joined_last_30d: '0',
      retention_day_1_pct: '0',
      retention_day_7_pct: '0',
      retention_day_30_pct: '0',
    };
    const subsRow = subsResult.rows[0] ?? {
      active_subscriptions: '0',
      paid_subscriptions: '0',
      conversion_to_paid_pct: '0',
      estimated_revenue_usd_30d: '0',
      arpu_usd_30d: '0',
    };

    return {
      totalUsers: Number(usersRow.total_users || 0),
      activeUsersLast7d: Number(usersRow.active_users_last_7d || 0),
      joinedLast7d: Number(usersRow.joined_last_7d || 0),
      joinedLast30d: Number(usersRow.joined_last_30d || 0),
      activeSubscriptions: Number(subsRow.active_subscriptions || 0),
      retentionDay1: Number(usersRow.retention_day_1_pct || 0),
      retentionDay7: Number(usersRow.retention_day_7_pct || 0),
      retentionDay30: Number(usersRow.retention_day_30_pct || 0),
      conversionToPaid: Number(subsRow.conversion_to_paid_pct || 0),
      arpuUsd30d: Number(subsRow.arpu_usd_30d || 0),
      estimatedRevenueUsd30d: Number(subsRow.estimated_revenue_usd_30d || 0),
      paidSubscriptions: Number(subsRow.paid_subscriptions || 0),
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

export async function grantSubscriptionByAdmin(
  data: AdminGrantSubscriptionData
): Promise<AdminGrantSubscriptionResult> {
  const client = await getPostgresClient();
  const now = new Date();
  const durationDays = Math.max(1, Math.trunc(data.durationDays));
  const plan = data.plan?.trim() || 'premium';

  try {
    await client.query('BEGIN');

    const existingSub = await client.query<{ ends_at: string | null }>(
      `
      SELECT ends_at
      FROM user_subscriptions
      WHERE telegram_user_id = $1
      FOR UPDATE
      `,
      [data.telegramUserId]
    );

    const existingEndsAt = existingSub.rows[0]?.ends_at
      ? new Date(existingSub.rows[0].ends_at)
      : null;
    const baseDate =
      existingEndsAt && existingEndsAt.getTime() > now.getTime()
        ? existingEndsAt
        : now;
    const endsAt = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await client.query(
      `
      INSERT INTO user_subscriptions (telegram_user_id, status, plan, starts_at, ends_at, source, promo_code_id, updated_at)
      VALUES ($1, 'active', $2, now(), $3, 'manual_admin', NULL, now())
      ON CONFLICT (telegram_user_id) DO UPDATE
        SET status = 'active',
            plan = EXCLUDED.plan,
            ends_at = EXCLUDED.ends_at,
            source = 'manual_admin',
            promo_code_id = NULL,
            updated_at = now()
      `,
      [data.telegramUserId, plan, endsAt.toISOString()]
    );

    await client.query('COMMIT');

    return {
      telegramUserId: String(data.telegramUserId),
      startsAt: now.toISOString(),
      endsAt: endsAt.toISOString(),
      plan,
      source: 'manual_admin',
      grantedBy: data.adminUserId ? String(data.adminUserId) : null,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export type UserSubscription = {
  plan: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

/**
 * Get user subscription data
 */
export async function getUserSubscription(telegramUserId: number): Promise<UserSubscription | null> {
  const client = await getPostgresClient();
  const now = new Date();

  try {
    const result = await client.query<{
      plan: string;
      status: string;
      starts_at: string | null;
      ends_at: string | null;
    }>(
      `
      SELECT plan, status, starts_at, ends_at
      FROM user_subscriptions
      WHERE telegram_user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
      `,
      [telegramUserId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    const endsAt = row.ends_at ? new Date(row.ends_at) : null;
    const isActive =
      row.status === 'active' && (endsAt === null || endsAt.getTime() > now.getTime());

    return {
      plan: row.plan || 'free',
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isActive,
    };
  } finally {
    client.release();
  }
}
