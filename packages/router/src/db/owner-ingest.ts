import { getPostgresClient } from './postgres';

type UserProfile = {
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  phone_number?: string | null;
  email?: string | null;
  language_code?: string | null;
};

type IngestParams = {
  botId: string;
  sourceId: string;
  type: 'message_received' | 'lead_created' | 'order_created' | 'appointment_created' | 'payment_status' | 'custom';
  telegramUserId?: number | null;
  customerName?: string | null;
  messageText?: string | null;
  payload?: Record<string, unknown> | null;
  profile?: UserProfile;
};

async function ensureDedup(botId: string, sourceId: string): Promise<boolean> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `INSERT INTO event_dedup (bot_id, source_id)
       VALUES ($1, $2)
       ON CONFLICT (bot_id, source_id)
       DO NOTHING`,
      [botId, sourceId]
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}

async function upsertCustomer(params: {
  botId: string;
  telegramUserId?: number | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  profile?: UserProfile;
}): Promise<string | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ id: string }>(
      `INSERT INTO customers (
         bot_id, telegram_user_id, name, phone, email, metadata, last_seen_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, now()
       )
       ON CONFLICT (bot_id, telegram_user_id)
       WHERE telegram_user_id IS NOT NULL
       DO UPDATE SET
         name = COALESCE(EXCLUDED.name, customers.name),
         phone = COALESCE(EXCLUDED.phone, customers.phone),
         email = COALESCE(EXCLUDED.email, customers.email),
         metadata = COALESCE(EXCLUDED.metadata, customers.metadata),
         last_seen_at = now(),
         updated_at = now()
       RETURNING id::text as id`,
      [
        params.botId,
        params.telegramUserId ?? null,
        params.name ?? null,
        params.phone ?? null,
        params.email ?? null,
        params.profile ?? null,
      ]
    );
    return result.rows[0]?.id ?? null;
  } finally {
    client.release();
  }
}

function inferOperationalType(messageText?: string | null): 'lead' | 'order' | 'appointment' | null {
  const value = (messageText || '').toLowerCase();
  if (!value) return null;
  if (value.includes('заказ') || value.includes('доставка') || value.includes('оплат')) return 'order';
  if (value.includes('запис') || value.includes('время') || value.includes('мастер')) return 'appointment';
  if (value.includes('заявк') || value.includes('хочу') || value.includes('интерес')) return 'lead';
  return null;
}

export async function ingestOwnerEvent(params: IngestParams): Promise<void> {
  const isFresh = await ensureDedup(params.botId, params.sourceId);
  if (!isFresh) return;

  const customerId = await upsertCustomer({
    botId: params.botId,
    telegramUserId: params.telegramUserId ?? null,
    name: params.customerName ?? null,
    profile: params.profile,
    phone: params.profile?.phone_number ?? null,
    email: params.profile?.email ?? null,
  });

  const inferred = inferOperationalType(params.messageText);
  let entityType: string | null = customerId ? 'customer' : null;
  let entityId: string | null = customerId;
  let eventType = params.type;

  const client = await getPostgresClient();
  try {
    await client.query('BEGIN');

    if (inferred === 'lead') {
      const lead = await client.query<{ id: string }>(
        `INSERT INTO leads (bot_id, customer_id, status, title, message, source, payload_json)
         VALUES ($1, $2::uuid, 'new', $3, $4, 'telegram', $5)
         RETURNING id::text as id`,
        [params.botId, customerId, 'Новая заявка', params.messageText ?? null, params.payload ?? null]
      );
      entityType = 'lead';
      entityId = lead.rows[0]?.id ?? null;
      eventType = 'lead_created';
    } else if (inferred === 'order') {
      const order = await client.query<{ id: string }>(
        `INSERT INTO orders (bot_id, customer_id, status, payment_status, amount, currency, payload_json)
         VALUES ($1, $2::uuid, 'new', 'pending', NULL, 'RUB', $3)
         RETURNING id::text as id`,
        [params.botId, customerId, params.payload ?? null]
      );
      entityType = 'order';
      entityId = order.rows[0]?.id ?? null;
      eventType = 'order_created';
    } else if (inferred === 'appointment') {
      const startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const appointment = await client.query<{ id: string }>(
        `INSERT INTO appointments (bot_id, customer_id, status, starts_at, ends_at, payload_json)
         VALUES ($1, $2::uuid, 'new', $3::timestamptz, $4::timestamptz, $5)
         RETURNING id::text as id`,
        [params.botId, customerId, startsAt, endsAt, params.payload ?? null]
      );
      entityType = 'appointment';
      entityId = appointment.rows[0]?.id ?? null;
      eventType = 'appointment_created';
    }

    await client.query(
      `INSERT INTO bot_events (
         bot_id, type, entity_type, entity_id, status, priority, payload_json, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::uuid, 'new', 'normal', $5, now(), now()
       )`,
      [
        params.botId,
        eventType,
        entityType,
        entityId,
        {
          text: params.messageText ?? null,
          telegram_user_id: params.telegramUserId ?? null,
          ...params.payload,
        },
      ]
    );

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

