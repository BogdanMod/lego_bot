import { getPostgresClient } from './postgres';
import { getRedisClient } from './redis';

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

/** Явное событие из схемы (track.event) или request_contact → lead. При отсутствии — fallback по флагу. */
export type IngestTrackEvent = 'lead' | 'appointment' | null;

const FALLBACK_INFER_OPERATIONAL_TYPE =
  (process.env.FALLBACK_INFER_OPERATIONAL_TYPE ?? 'true').toLowerCase() === 'true';

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

/** Есть ли уже запись lead/appointment для (bot_id, customer_id) за последние 10 минут со статусом 'new'. */
async function hasRecentLeadOrAppointment(
  client: { query: (q: string, v: unknown[]) => Promise<{ rows: unknown[] }> },
  botId: string,
  customerId: string | null,
  kind: 'lead' | 'appointment'
): Promise<boolean> {
  if (!customerId) return false;
  const table = kind === 'lead' ? 'leads' : 'appointments';
  const result = await client.query(
    `SELECT 1 FROM ${table}
     WHERE bot_id = $1 AND customer_id = $2 AND status = 'new'
       AND created_at >= now() - interval '10 minutes'
     LIMIT 1`,
    [botId, customerId]
  );
  return (result.rows?.length ?? 0) > 0;
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
  // Запись: текст кнопки/сообщения или ключ состояния финала (thanks, confirm)
  if (
    value.includes('запис') ||
    value.includes('время') ||
    value.includes('мастер') ||
    value.includes('thanks') ||
    value.includes('thank') ||
    value.includes('spasibo') ||
    value.includes('confirm') ||
    value.includes('podtverd') ||
    value.includes('blagodar') ||
    value.includes('record') ||
    value.includes('booking')
  )
    return 'appointment';
  if (value.includes('заявк') || value.includes('хочу') || value.includes('интерес')) return 'lead';
  return null;
}

export type IngestResult = {
  created?: { type: 'lead' | 'appointment'; entityId: string };
};

export async function ingestOwnerEvent(
  params: IngestParams,
  options?: { trackEvent?: IngestTrackEvent; requestContact?: boolean }
): Promise<IngestResult> {
  const isFresh = await ensureDedup(params.botId, params.sourceId);
  if (!isFresh) return {};

  const customerId = await upsertCustomer({
    botId: params.botId,
    telegramUserId: params.telegramUserId ?? null,
    name: params.customerName ?? null,
    profile: params.profile,
    phone: params.profile?.phone_number ?? null,
    email: params.profile?.email ?? null,
  });

  const explicitTrack = options?.trackEvent ?? null;
  const isRequestContact = options?.requestContact === true;
  const inferredFromHeuristic =
    FALLBACK_INFER_OPERATIONAL_TYPE ? inferOperationalType(params.messageText) : null;
  const effective: IngestTrackEvent | 'order' | null =
    explicitTrack === 'lead' || explicitTrack === 'appointment'
      ? explicitTrack
      : isRequestContact
        ? 'lead'
        : inferredFromHeuristic;

  let entityType: string | null = customerId ? 'customer' : null;
  let entityId: string | null = customerId;
  let eventType = params.type;

  const client = await getPostgresClient();
  try {
    await client.query('BEGIN');

    let createdType: 'lead' | 'appointment' | null = null;
    if (effective === 'lead') {
      const recent = await hasRecentLeadOrAppointment(client, params.botId, customerId, 'lead');
      if (!recent) {
        const lead = await client.query<{ id: string }>(
          `INSERT INTO leads (bot_id, customer_id, status, title, message, source, payload_json)
           VALUES ($1, $2::uuid, 'new', $3, $4, 'telegram', $5)
           RETURNING id::text as id`,
          [params.botId, customerId, 'Новая заявка', params.messageText ?? null, params.payload ?? null]
        );
        entityType = 'lead';
        entityId = lead.rows[0]?.id ?? null;
        eventType = 'lead_created';
        createdType = 'lead';
        if (process.env.NODE_ENV !== 'production' && isRequestContact) {
          // eslint-disable-next-line no-console
          console.debug('[ingest] message.contact → lead created', { botId: params.botId, customerId });
        }
      } else if (process.env.NODE_ENV !== 'production' && isRequestContact) {
        // eslint-disable-next-line no-console
        console.debug('[ingest] message.contact → lead deduped (10m)', { botId: params.botId, customerId });
      }
    } else if (effective === 'order') {
      const order = await client.query<{ id: string }>(
        `INSERT INTO orders (bot_id, customer_id, status, payment_status, amount, currency, payload_json)
         VALUES ($1, $2::uuid, 'new', 'pending', NULL, 'RUB', $3)
         RETURNING id::text as id`,
        [params.botId, customerId, params.payload ?? null]
      );
      entityType = 'order';
      entityId = order.rows[0]?.id ?? null;
      eventType = 'order_created';
    } else if (effective === 'appointment') {
      const recent = await hasRecentLeadOrAppointment(client, params.botId, customerId, 'appointment');
      if (!recent) {
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
        createdType = 'appointment';
      }
    }

    const eventResult = await client.query<{ id: string; created_at: string }>(
      `INSERT INTO bot_events (
         bot_id, type, entity_type, entity_id, status, priority, payload_json, created_at, updated_at
       ) VALUES (
         $1, $2, $3, $4::uuid, 'new', 'normal', $5, now(), now()
       )
       RETURNING id::text as id, created_at::text as created_at`,
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

    // v2: Event pipeline - добавить событие в Redis Stream для обработки worker'ом
    const eventId = eventResult.rows[0]?.id;
    const eventCreatedAt = eventResult.rows[0]?.created_at;
    if (eventId && eventCreatedAt) {
      try {
        const redis = await getRedisClient();
        await redis.xAdd('events', '*', {
          bot_id: params.botId,
          event_id: eventId,
          type: eventType,
          entity_type: entityType || '',
          entity_id: entityId || '',
          created_at: eventCreatedAt,
          payload: JSON.stringify({
            text: params.messageText ?? null,
            telegram_user_id: params.telegramUserId ?? null,
            ...params.payload,
          }),
        });
      } catch (redisError) {
        // Не падаем, если Redis недоступен - события уже в БД
        console.error('[ingest] Failed to add event to Redis stream:', redisError);
      }
    }
    const createdResult: IngestResult =
      createdType && entityId
        ? { created: { type: createdType, entityId } }
        : {};
    return createdResult;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

