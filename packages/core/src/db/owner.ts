import { getPostgresClient } from './postgres';

export type OwnerRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type OwnerEventStatus = 'new' | 'in_progress' | 'done' | 'cancelled';
export type OwnerEventPriority = 'low' | 'normal' | 'high';

export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type OwnerBotAccess = {
  botId: string;
  name: string;
  role: OwnerRole;
};

type CursorToken = { created_at: string; id: string };

function encodeCursor(value: CursorToken): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

function decodeCursor(cursor?: string): CursorToken | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8')) as CursorToken;
  } catch {
    return null;
  }
}

function normalizeLimit(value: number | undefined, fallback = 50, max = 200): number {
  const num = Number(value ?? fallback);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.floor(num), 1), max);
}

export async function getOwnerAccessibleBots(telegramUserId: number): Promise<OwnerBotAccess[]> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<OwnerBotAccess>(
      `SELECT
         b.id::text as "botId",
         b.name as name,
         ba.role::text as role
       FROM bot_admins ba
       JOIN bots b ON b.id = ba.bot_id
       WHERE ba.telegram_user_id = $1
         AND b.is_active = true
       ORDER BY b.created_at DESC`,
      [telegramUserId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getBotRoleForUser(botId: string, telegramUserId: number): Promise<OwnerRole | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ role: OwnerRole }>(
      `SELECT role::text as role
       FROM bot_admins
       WHERE bot_id = $1 AND telegram_user_id = $2
       LIMIT 1`,
      [botId, telegramUserId]
    );
    return result.rows[0]?.role ?? null;
  } finally {
    client.release();
  }
}

// v2: RBAC 2.0 - получить роль и permissions
export async function getBotRoleAndPermissions(botId: string, telegramUserId: number): Promise<{ role: OwnerRole; permissions: Record<string, boolean> } | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{ role: OwnerRole; permissions_json: Record<string, boolean> | null }>(
      `SELECT role::text as role, permissions_json
       FROM bot_admins
       WHERE bot_id = $1 AND telegram_user_id = $2
       LIMIT 1`,
      [botId, telegramUserId]
    );
    if (!result.rows[0]) return null;
    
    const { role, permissions_json } = result.rows[0];
    // Если permissions_json не задан, используем дефолтные на основе роли
    const permissions = permissions_json || getDefaultPermissions(role);
    
    return { role, permissions };
  } finally {
    client.release();
  }
}

function getDefaultPermissions(role: OwnerRole): Record<string, boolean> {
  const defaults: Record<string, Record<string, boolean>> = {
    owner: {
      'orders.write': true,
      'orders.read': true,
      'leads.write': true,
      'leads.read': true,
      'customers.write': true,
      'customers.read': true,
      'appointments.write': true,
      'appointments.read': true,
      'team.write': true,
      'team.read': true,
      'settings.write': true,
      'settings.read': true,
      'audit.read': true,
      'export': true,
    },
    admin: {
      'orders.write': true,
      'orders.read': true,
      'leads.write': true,
      'leads.read': true,
      'customers.write': true,
      'customers.read': true,
      'appointments.write': true,
      'appointments.read': true,
      'team.write': false,
      'team.read': true,
      'settings.write': false,
      'settings.read': true,
      'audit.read': true,
      'export': true,
    },
    staff: {
      'orders.write': true,
      'orders.read': true,
      'leads.write': true,
      'leads.read': true,
      'customers.write': true,
      'customers.read': true,
      'appointments.write': true,
      'appointments.read': true,
      'team.write': false,
      'team.read': false,
      'settings.write': false,
      'settings.read': false,
      'audit.read': false,
      'export': true,
    },
    viewer: {
      'orders.write': false,
      'orders.read': true,
      'leads.write': false,
      'leads.read': true,
      'customers.write': false,
      'customers.read': true,
      'appointments.write': false,
      'appointments.read': true,
      'team.write': false,
      'team.read': false,
      'settings.write': false,
      'settings.read': false,
      'audit.read': false,
      'export': false,
    },
  };
  return defaults[role] || defaults.viewer;
}

export async function listBotTeam(botId: string): Promise<Array<{ telegramUserId: string; role: OwnerRole; createdAt: string }>> {
  const client = await getPostgresClient();
  try {
    const result = await client.query<{
      telegramUserId: string;
      role: OwnerRole;
      createdAt: string;
    }>(
      `SELECT
         telegram_user_id::text as "telegramUserId",
         role::text as role,
         created_at::text as "createdAt"
       FROM bot_admins
       WHERE bot_id = $1
       ORDER BY
         CASE role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'staff' THEN 3
           ELSE 4
         END,
         created_at ASC`,
      [botId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function upsertBotTeamMember(params: {
  botId: string;
  telegramUserId: number;
  role: OwnerRole;
  actorUserId: number;
  permissionsJson?: Record<string, unknown> | null;
}): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query(
      `INSERT INTO bot_admins (bot_id, telegram_user_id, role, permissions_json, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (bot_id, telegram_user_id)
       DO UPDATE SET
         role = EXCLUDED.role,
         permissions_json = EXCLUDED.permissions_json`,
      [params.botId, params.telegramUserId, params.role, params.permissionsJson ?? null, params.actorUserId]
    );
  } finally {
    client.release();
  }
}

export async function removeBotTeamMember(botId: string, telegramUserId: number): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query(
      `DELETE FROM bot_admins
       WHERE bot_id = $1
         AND telegram_user_id = $2
         AND role <> 'owner'`,
      [botId, telegramUserId]
    );
  } finally {
    client.release();
  }
}

export async function getBotSettings(botId: string): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `SELECT
         bot_id::text as "botId",
         timezone,
         business_name as "businessName",
         brand_json as "brand",
         working_hours_json as "workingHours",
         notify_new_leads as "notifyNewLeads",
         notify_new_orders as "notifyNewOrders",
         notify_new_appointments as "notifyNewAppointments",
         notify_chat_id::text as "notifyChatId",
         updated_at::text as "updatedAt"
       FROM bot_settings
       WHERE bot_id = $1
       LIMIT 1`,
      [botId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function updateBotSettings(botId: string, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `INSERT INTO bot_settings (
        bot_id,
        timezone,
        business_name,
        brand_json,
        working_hours_json,
        notify_new_leads,
        notify_new_orders,
        notify_new_appointments,
        notify_chat_id,
        updated_at
      ) VALUES (
        $1,
        COALESCE($2, 'Europe/Moscow'),
        $3,
        $4,
        $5,
        COALESCE($6, true),
        COALESCE($7, true),
        COALESCE($8, true),
        $9,
        now()
      )
      ON CONFLICT (bot_id)
      DO UPDATE SET
        timezone = COALESCE($2, bot_settings.timezone),
        business_name = COALESCE($3, bot_settings.business_name),
        brand_json = COALESCE($4, bot_settings.brand_json),
        working_hours_json = COALESCE($5, bot_settings.working_hours_json),
        notify_new_leads = COALESCE($6, bot_settings.notify_new_leads),
        notify_new_orders = COALESCE($7, bot_settings.notify_new_orders),
        notify_new_appointments = COALESCE($8, bot_settings.notify_new_appointments),
        notify_chat_id = COALESCE($9, bot_settings.notify_chat_id),
        updated_at = now()
      RETURNING
        bot_id::text as "botId",
        timezone,
        business_name as "businessName",
        brand_json as "brand",
        working_hours_json as "workingHours",
        notify_new_leads as "notifyNewLeads",
        notify_new_orders as "notifyNewOrders",
        notify_new_appointments as "notifyNewAppointments",
        notify_chat_id::text as "notifyChatId",
        updated_at::text as "updatedAt"`,
      [
        botId,
        patch.timezone ?? null,
        patch.businessName ?? null,
        patch.brand ?? null,
        patch.workingHours ?? null,
        patch.notifyNewLeads ?? null,
        patch.notifyNewOrders ?? null,
        patch.notifyNewAppointments ?? null,
        patch.notifyChatId ?? null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function listInboxEvents(params: {
  botId: string;
  status?: OwnerEventStatus;
  type?: string;
  q?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}): Promise<CursorPage<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const limit = normalizeLimit(params.limit, 50, 200);
    const decoded = decodeCursor(params.cursor);
    const values: any[] = [params.botId, limit + 1];
    const where: string[] = ['be.bot_id = $1'];

    if (params.status) {
      values.push(params.status);
      where.push(`be.status = $${values.length}`);
    }
    if (params.type) {
      values.push(params.type);
      where.push(`be.type = $${values.length}`);
    }
    if (params.from) {
      values.push(params.from);
      where.push(`be.created_at >= $${values.length}`);
    }
    if (params.to) {
      values.push(params.to);
      where.push(`be.created_at <= $${values.length}`);
    }
    if (decoded) {
      values.push(decoded.created_at, decoded.id);
      where.push(`(be.created_at, be.id) < ($${values.length - 1}, $${values.length})`);
    }
    if (params.q && params.q.trim()) {
      values.push(`%${params.q.trim().toLowerCase()}%`);
      where.push(
        `(
          lower(COALESCE(c.name, '')) LIKE $${values.length}
          OR lower(COALESCE(c.phone, '')) LIKE $${values.length}
          OR lower(COALESCE(c.email, '')) LIKE $${values.length}
          OR lower(COALESCE(s.name, '')) LIKE $${values.length}
          OR lower(COALESCE(be.payload_json::text, '')) LIKE $${values.length}
        )`
      );
    }

    const result = await client.query(
      `SELECT
         be.id::text as id,
         be.bot_id::text as "botId",
         be.type,
         be.entity_type as "entityType",
         be.entity_id::text as "entityId",
         be.status,
         be.priority,
         be.assignee::text as assignee,
         be.payload_json as payload,
         be.created_at::text as "createdAt",
         be.updated_at::text as "updatedAt"
       FROM bot_events be
       LEFT JOIN customers c ON c.id = be.entity_id AND be.entity_type = 'customer'
       LEFT JOIN services s ON s.id = be.entity_id AND be.entity_type = 'service'
       WHERE ${where.join(' AND ')}
       ORDER BY be.created_at DESC, be.id DESC
       LIMIT $2`,
      values
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1] as any;
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: String(last.createdAt), id: String(last.id) })
        : null;
    return { items, nextCursor, hasMore };
  } finally {
    client.release();
  }
}

export async function getEventsSummary(botId: string): Promise<Record<string, unknown>> {
  const client = await getPostgresClient();
  try {
    const totals = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text as total FROM bot_events WHERE bot_id = $1`,
      [botId]
    );
    const byStatus = await client.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text as count
       FROM bot_events
       WHERE bot_id = $1
       GROUP BY status`,
      [botId]
    );
    const byType = await client.query<{ type: string; count: string }>(
      `SELECT type, COUNT(*)::text as count
       FROM bot_events
       WHERE bot_id = $1
       GROUP BY type`,
      [botId]
    );
    return {
      total: Number(totals.rows[0]?.total ?? 0),
      byStatus: byStatus.rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = Number(row.count);
        return acc;
      }, {}),
      byType: byType.rows.reduce<Record<string, number>>((acc, row) => {
        acc[row.type] = Number(row.count);
        return acc;
      }, {}),
    };
  } finally {
    client.release();
  }
}

export async function patchEvent(
  botId: string,
  eventId: string,
  patch: { status?: OwnerEventStatus; priority?: OwnerEventPriority; assignee?: number | null }
): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE bot_events
       SET
         status = COALESCE($3, status),
         priority = COALESCE($4, priority),
         assignee = COALESCE($5, assignee),
         updated_at = now()
       WHERE bot_id = $1 AND id = $2
       RETURNING
         id::text as id,
         bot_id::text as "botId",
         type,
         entity_type as "entityType",
         entity_id::text as "entityId",
         status,
         priority,
         assignee::text as assignee,
         payload_json as payload,
         created_at::text as "createdAt",
         updated_at::text as "updatedAt"`,
      [botId, eventId, patch.status ?? null, patch.priority ?? null, patch.assignee ?? null]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function addEventNote(params: {
  botId: string;
  eventId: string;
  authorTelegramUserId: number;
  note: string;
}): Promise<Record<string, unknown>> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `INSERT INTO event_notes (event_id, bot_id, author_telegram_user_id, note)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id::text as id,
         event_id::text as "eventId",
         bot_id::text as "botId",
         author_telegram_user_id::text as "authorTelegramUserId",
         note,
         created_at::text as "createdAt"`,
      [params.eventId, params.botId, params.authorTelegramUserId, params.note]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

async function listEntityTable(
  tableName: 'customers' | 'orders' | 'leads',
  params: { botId: string; cursor?: string; limit?: number; q?: string; status?: string },
  searchableColumns: string[],
  extraWhere?: string
): Promise<CursorPage<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const limit = normalizeLimit(params.limit, 50, 200);
    const decoded = decodeCursor(params.cursor);
    const values: any[] = [params.botId, limit + 1];
    const where: string[] = ['bot_id = $1'];
    if (params.status) {
      values.push(params.status);
      where.push(`status = $${values.length}`);
    }
    if (extraWhere) where.push(extraWhere);
    if (decoded) {
      values.push(decoded.created_at, decoded.id);
      where.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
    }
    if (params.q && params.q.trim()) {
      values.push(`%${params.q.trim().toLowerCase()}%`);
      const idx = values.length;
      where.push(`(${searchableColumns.map((c) => `lower(COALESCE(${c}::text, '')) LIKE $${idx}`).join(' OR ')})`);
    }

    const result = await client.query(
      `SELECT *
       FROM ${tableName}
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      values
    );
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1] as any;
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: String(last.created_at), id: String(last.id) })
        : null;
    return { items, nextCursor, hasMore };
  } finally {
    client.release();
  }
}

export function listCustomers(params: {
  botId: string;
  cursor?: string;
  limit?: number;
  q?: string;
}): Promise<CursorPage<Record<string, unknown>>> {
  return listEntityTable('customers', params, ['name', 'phone', 'email']);
}

export function listOrders(params: {
  botId: string;
  cursor?: string;
  limit?: number;
  q?: string;
  status?: string;
}): Promise<CursorPage<Record<string, unknown>>> {
  return listEntityTable('orders', params, ['id', 'tracking', 'payload_json', 'status', 'payment_status']);
}

export function listLeads(params: {
  botId: string;
  cursor?: string;
  limit?: number;
  q?: string;
  status?: string;
}): Promise<CursorPage<Record<string, unknown>>> {
  return listEntityTable('leads', params, ['id', 'title', 'message', 'payload_json', 'status']);
}

export async function getCustomer(botId: string, customerId: string): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `SELECT *
       FROM customers
       WHERE bot_id = $1 AND id = $2
       LIMIT 1`,
      [botId, customerId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function patchCustomer(
  botId: string,
  customerId: string,
  patch: { tags?: string[]; notes?: string | null; name?: string | null; phone?: string | null; email?: string | null }
): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE customers
       SET
         tags = COALESCE($3::jsonb, tags),
         notes = COALESCE($4, notes),
         name = COALESCE($5, name),
         phone = COALESCE($6, phone),
         email = COALESCE($7, email),
         updated_at = now()
       WHERE bot_id = $1 AND id = $2
       RETURNING *`,
      [botId, customerId, patch.tags ? JSON.stringify(patch.tags) : null, patch.notes ?? null, patch.name ?? null, patch.phone ?? null, patch.email ?? null]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function getCustomerTimeline(botId: string, customerId: string): Promise<Array<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `SELECT
         be.id::text as id,
         be.type,
         be.entity_type as "entityType",
         be.entity_id::text as "entityId",
         be.status,
         be.priority,
         be.payload_json as payload,
         be.created_at::text as "createdAt",
         be.updated_at::text as "updatedAt"
       FROM bot_events be
       WHERE be.bot_id = $1
         AND (
           (be.entity_type = 'customer' AND be.entity_id = $2::uuid)
           OR lower(COALESCE(be.payload_json::text, '')) LIKE (
             SELECT '%' || lower(COALESCE(phone, '')) || '%'
             FROM customers
             WHERE id = $2::uuid
             LIMIT 1
           )
         )
       ORDER BY be.created_at DESC
       LIMIT 500`,
      [botId, customerId]
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function listAppointments(params: {
  botId: string;
  from?: string;
  to?: string;
  staffId?: string;
  status?: string;
}): Promise<Array<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const values: any[] = [params.botId];
    const where: string[] = ['a.bot_id = $1'];
    if (params.from) {
      values.push(params.from);
      where.push(`a.starts_at >= $${values.length}`);
    }
    if (params.to) {
      values.push(params.to);
      where.push(`a.ends_at <= $${values.length}`);
    }
    if (params.staffId) {
      values.push(params.staffId);
      where.push(`a.staff_id = $${values.length}::uuid`);
    }
    if (params.status) {
      values.push(params.status);
      where.push(`a.status = $${values.length}`);
    }
    const result = await client.query(
      `SELECT
         a.*,
         c.name as customer_name,
         c.phone as customer_phone,
         s.name as staff_name,
         sv.name as service_name
       FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN staff s ON s.id = a.staff_id
       LEFT JOIN services sv ON sv.id = a.service_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.starts_at ASC`,
      values
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function createAppointment(params: {
  botId: string;
  customerId?: string | null;
  staffId?: string | null;
  serviceId?: string | null;
  startsAt: string;
  endsAt: string;
  status?: string;
  notes?: string | null;
  payloadJson?: Record<string, unknown> | null;
}): Promise<Record<string, unknown>> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `INSERT INTO appointments (
         bot_id, customer_id, staff_id, service_id, status, starts_at, ends_at, notes, payload_json
       ) VALUES (
         $1, $2::uuid, $3::uuid, $4::uuid, COALESCE($5, 'new'), $6::timestamptz, $7::timestamptz, $8, $9
       )
       RETURNING *`,
      [
        params.botId,
        params.customerId ?? null,
        params.staffId ?? null,
        params.serviceId ?? null,
        params.status ?? null,
        params.startsAt,
        params.endsAt,
        params.notes ?? null,
        params.payloadJson ?? null,
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function patchAppointment(
  botId: string,
  appointmentId: string,
  patch: {
    startsAt?: string;
    endsAt?: string;
    status?: string;
    staffId?: string | null;
    serviceId?: string | null;
    notes?: string | null;
  }
): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE appointments
       SET
         starts_at = COALESCE($3::timestamptz, starts_at),
         ends_at = COALESCE($4::timestamptz, ends_at),
         status = COALESCE($5, status),
         staff_id = COALESCE($6::uuid, staff_id),
         service_id = COALESCE($7::uuid, service_id),
         notes = COALESCE($8, notes),
         updated_at = now()
       WHERE bot_id = $1 AND id = $2
       RETURNING *`,
      [
        botId,
        appointmentId,
        patch.startsAt ?? null,
        patch.endsAt ?? null,
        patch.status ?? null,
        patch.staffId ?? null,
        patch.serviceId ?? null,
        patch.notes ?? null,
      ]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function getAvailability(params: {
  botId: string;
  date: string;
  serviceId?: string;
  staffId?: string;
}): Promise<Array<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const dayStart = `${params.date}T00:00:00.000Z`;
    const dayEnd = `${params.date}T23:59:59.999Z`;
    const values: any[] = [params.botId, dayStart, dayEnd];
    let staffFilter = '';
    if (params.staffId) {
      values.push(params.staffId);
      staffFilter = ` AND a.staff_id = $${values.length}::uuid`;
    }
    const result = await client.query(
      `SELECT
         a.id::text as "appointmentId",
         a.staff_id::text as "staffId",
         a.service_id::text as "serviceId",
         a.starts_at::text as "startsAt",
         a.ends_at::text as "endsAt",
         a.status
       FROM appointments a
       WHERE a.bot_id = $1
         AND a.starts_at >= $2::timestamptz
         AND a.starts_at <= $3::timestamptz
         ${staffFilter}
       ORDER BY a.starts_at ASC`,
      values
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getOrder(botId: string, orderId: string): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `SELECT *
       FROM orders
       WHERE bot_id = $1 AND id = $2
       LIMIT 1`,
      [botId, orderId]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function patchOrder(
  botId: string,
  orderId: string,
  patch: { status?: string; tracking?: string | null; amount?: number | null; paymentStatus?: string | null }
): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE orders
       SET
         status = COALESCE($3, status),
         tracking = COALESCE($4, tracking),
         amount = COALESCE($5, amount),
         payment_status = COALESCE($6, payment_status),
         updated_at = now()
       WHERE bot_id = $1 AND id = $2
       RETURNING *`,
      [botId, orderId, patch.status ?? null, patch.tracking ?? null, patch.amount ?? null, patch.paymentStatus ?? null]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function patchLead(
  botId: string,
  leadId: string,
  patch: { status?: string; assignee?: number | null }
): Promise<Record<string, unknown> | null> {
  const client = await getPostgresClient();
  try {
    const result = await client.query(
      `UPDATE leads
       SET
         status = COALESCE($3, status),
         assignee = COALESCE($4, assignee),
         updated_at = now()
       WHERE bot_id = $1 AND id = $2
       RETURNING *`,
      [botId, leadId, patch.status ?? null, patch.assignee ?? null]
    );
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function insertOwnerAudit(params: {
  botId: string;
  actorTelegramUserId: number;
  entity: string;
  entityId?: string | null;
  action: string;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
  requestId?: string | null;
}): Promise<void> {
  const client = await getPostgresClient();
  try {
    await client.query(
      `INSERT INTO owner_audit_log (
         bot_id, actor_telegram_user_id, entity, entity_id, action, before_json, after_json, request_id
       ) VALUES ($1, $2, $3, $4::uuid, $5, $6, $7, $8)`,
      [
        params.botId,
        params.actorTelegramUserId,
        params.entity,
        params.entityId ?? null,
        params.action,
        params.beforeJson ?? null,
        params.afterJson ?? null,
        params.requestId ?? null,
      ]
    );
  } finally {
    client.release();
  }
}

// v2: Billing-ready - получить usage статистику
export async function getBotUsage(botId: string, from?: string, to?: string): Promise<Array<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const values: any[] = [botId];
    const where: string[] = ['bot_id = $1'];
    
    if (from) {
      values.push(from);
      where.push(`date >= $${values.length}::date`);
    }
    if (to) {
      values.push(to);
      where.push(`date <= $${values.length}::date`);
    }
    
    const result = await client.query(
      `SELECT
         date::text as date,
         events_count as "eventsCount",
         messages_count as "messagesCount",
         customers_count as "customersCount",
         leads_count as "leadsCount",
         orders_count as "ordersCount",
         appointments_count as "appointmentsCount",
         updated_at::text as "updatedAt"
       FROM bot_usage_daily
       WHERE ${where.join(' AND ')}
       ORDER BY date DESC
       LIMIT 365`,
      values
    );
    return result.rows;
  } finally {
    client.release();
  }
}

export async function listOwnerAudit(params: {
  botId: string;
  cursor?: string;
  limit?: number;
}): Promise<CursorPage<Record<string, unknown>>> {
  const client = await getPostgresClient();
  try {
    const limit = normalizeLimit(params.limit, 50, 200);
    const decoded = decodeCursor(params.cursor);
    const values: any[] = [params.botId, limit + 1];
    const where: string[] = ['bot_id = $1'];
    if (decoded) {
      values.push(decoded.created_at, decoded.id);
      where.push(`(created_at, id) < ($${values.length - 1}, $${values.length})`);
    }
    const result = await client.query(
      `SELECT
         id::text as id,
         bot_id::text as "botId",
         actor_telegram_user_id::text as "actorTelegramUserId",
         entity,
         entity_id::text as "entityId",
         action,
         before_json as "before",
         after_json as "after",
         request_id as "requestId",
         created_at::text as "createdAt"
       FROM owner_audit_log
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      values
    );
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1] as any;
    const nextCursor =
      hasMore && last
        ? encodeCursor({ created_at: String(last.createdAt), id: String(last.id) })
        : null;
    return { items, nextCursor, hasMore };
  } finally {
    client.release();
  }
}

export async function listExportRows(params: {
  botId: string;
  type: 'leads' | 'orders' | 'appointments' | 'customers' | 'events';
  from?: string;
  to?: string;
  status?: string;
}): Promise<Array<Record<string, unknown>>> {
  const table =
    params.type === 'leads'
      ? 'leads'
      : params.type === 'orders'
        ? 'orders'
        : params.type === 'appointments'
          ? 'appointments'
          : params.type === 'customers'
            ? 'customers'
            : 'bot_events';

  const client = await getPostgresClient();
  try {
    const values: any[] = [params.botId];
    const where: string[] = ['bot_id = $1'];
    if (params.from) {
      values.push(params.from);
      where.push(`created_at >= $${values.length}::timestamptz`);
    }
    if (params.to) {
      values.push(params.to);
      where.push(`created_at <= $${values.length}::timestamptz`);
    }
    if (params.status) {
      values.push(params.status);
      where.push(`status = $${values.length}`);
    }
    const result = await client.query(
      `SELECT *
       FROM ${table}
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC`,
      values
    );
    return result.rows;
  } finally {
    client.release();
  }
}

