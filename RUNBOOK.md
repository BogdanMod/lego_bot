# Owner Cabinet Runbook (v2)

## v2 Architecture Overview

### Event-Driven Pipeline
- Router ingest: Creates `bot_events` → XADD to Redis Stream `events`
- Worker: Reads from Stream (consumer group), processes events, updates entities
- DLQ: Failed events go to `events:dead` stream after 3 retries

### Realtime SSE
- Endpoint: `GET /api/owner/bots/:botId/stream`
- Worker publishes to Redis PubSub `bot:{botId}:events`
- Owner-web subscribes via EventSource, invalidates TanStack Query cache

### RBAC 2.0
- Permissions stored in `bot_admins.permissions_json`
- Default permissions per role (owner/admin/staff/viewer)
- Middleware: `requirePermission('orders.write')` etc.

### Tenant Isolation
- All endpoints require `botId` (except `/auth/*` and `/bots`)
- `requireBotContext` middleware validates access and sets `botContext`
- Strict `bot_id` filtering in all queries

### Observability
- `request_id` in all requests/responses
- Structured logs: `{requestId, botId, userId, route, method, statusCode, latency}`
- Sentry integration (core + owner-web) with safe beforeSend hooks

### Billing-Ready
- Table: `bot_usage_daily` (date, events_count, messages_count, etc.)
- Worker incrementally updates counters
- Endpoint: `GET /api/owner/bots/:botId/usage` (read-only)

## Debugging

### Check Session
```bash
curl -v https://lego-bot-ownerweb.vercel.app/api/core/owner/_debug/session \
  -H "Cookie: owner_session=<token>"
```

Response:
```json
{
  "hasCookie": true,
  "userId": 123456789,
  "botCount": 2,
  "csrfPresent": true
}
```

### Check Redis
```bash
curl https://lego-bot-core.vercel.app/api/owner/_debug/redis \
  -H "Cookie: owner_session=<token>"
```

### Test Botlink Flow
1. Open Telegram bot
2. Send `/cabinet`
3. Click "Открыть кабинет" button
4. Verify token in URL: `?token=...`
5. Check Redis for jti: `GET owner:botlink:jti:<jti>`
6. Verify cookie is set after redirect

### Test API Endpoint
```bash
# Get bot info
curl https://lego-bot-ownerweb.vercel.app/api/core/owner/bots/<botId>/me \
  -H "Cookie: owner_session=<token>"

# Get inbox events
curl "https://lego-bot-ownerweb.vercel.app/api/core/owner/bots/<botId>/events?status=new&limit=10" \
  -H "Cookie: owner_session=<token>"
```

### Check Request ID
All error responses include `request_id`. Use it to trace logs:
```json
{
  "code": "forbidden",
  "message": "Нет доступа к этому боту",
  "request_id": "abc123..."
}
```

Search logs for: `request_id:abc123`

## Common Issues

### "Proxy returning blank page"
- Check CORE_API_ORIGIN env var in owner-web
- Verify proxy route has `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`
- Check Vercel logs for proxy errors

### "CSRF token mismatch"
- Verify `/api/core/owner/auth/me` returns csrfToken
- Check x-csrf-token header is sent with mutations
- Verify cookie is same-origin (not third-party)

### "Botlink token expired/used"
- Normal: tokens expire after 2 minutes
- If immediately "used": check Redis for jti collision
- Verify Redis NX EX is working

### "No access to bot"
- Check `bot_admins` table: `SELECT * FROM bot_admins WHERE bot_id = '<botId>' AND telegram_user_id = <userId>`
- Verify role is not NULL
- Check requireOwnerBotAccess middleware is called

### "Empty responses"
- Check proxy error handling (should return JSON, never empty)
- Verify upstream API returns body
- Check content-type header is forwarded

## Database Queries

### Check Bot Access
```sql
SELECT ba.*, b.name as bot_name
FROM bot_admins ba
JOIN bots b ON b.id = ba.bot_id
WHERE ba.telegram_user_id = 123456789;
```

### Check Events
```sql
SELECT COUNT(*), status
FROM bot_events
WHERE bot_id = '<botId>'
GROUP BY status;
```

### Check Usage Counters (v2)
```sql
SELECT date, events_count, messages_count, customers_count, leads_count, orders_count, appointments_count
FROM bot_usage_daily
WHERE bot_id = '<botId>'
ORDER BY date DESC
LIMIT 30;
```

### Check Recent Activity
```sql
SELECT * FROM owner_audit_log
WHERE bot_id = '<botId>'
ORDER BY created_at DESC
LIMIT 20;
```

## Performance

### Check Indexes
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('bot_events', 'orders', 'appointments', 'customers')
ORDER BY tablename, indexname;
```

### Check Slow Queries
Enable slow query log in Neon dashboard or use:
```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE query LIKE '%bot_events%'
ORDER BY mean_time DESC
LIMIT 10;
```

## Redis Debugging

### Check Botlink jti
```bash
redis-cli GET "owner:botlink:jti:<jti>"
```

### Check Event Stream
```bash
# Check stream length
redis-cli XLEN events

# Read from stream
redis-cli XREAD COUNT 10 STREAMS events 0

# Check consumer group
redis-cli XINFO GROUPS events
```

### Check PubSub
```bash
# Subscribe to bot events
redis-cli SUBSCRIBE "bot:<botId>:events"
```

### Check DLQ
```bash
redis-cli XLEN "events:dead"
redis-cli XREAD COUNT 10 STREAMS "events:dead" 0
```

### Check Connection
```bash
redis-cli PING
# Should return: PONG
```

## Logs

### Vercel Logs
- Core: Check function logs for `/api/owner/*` requests
- Owner-Web: Check Next.js build/runtime logs
- Look for `request_id` in error messages

### Structured Logs (v2)
All logs include:
- `request_id`
- `userId` (for owner requests)
- `botId` (for bot-scoped requests)
- `route` (API path)
- `method` (HTTP method)
- `statusCode` (response status)
- `latency` (ms)

Search pattern:
```
request_id:abc123 userId:123456789 botId:xyz route:/api/owner/bots/xyz/events latency:45
```

### Worker Logs
Worker logs include:
- `botId`, `eventId`, `eventType`, `entityType`
- Processing errors with retry count
- DLQ sends with error details

## Recovery

### Reset User Session
1. User logs out (clears cookie)
2. Or: Delete cookie manually in browser
3. Re-authenticate via `/cabinet`

### Fix Bot Access
```sql
-- Add user as owner
INSERT INTO bot_admins (bot_id, telegram_user_id, role, created_by)
VALUES ('<botId>', <userId>, 'owner', <userId>)
ON CONFLICT (bot_id, telegram_user_id) DO UPDATE SET role = 'owner';
```

### Clear Redis Botlink jti
```bash
redis-cli DEL "owner:botlink:jti:<jti>"
```

## Health Checks

### Core Health
```bash
curl https://lego-bot-core.vercel.app/api/health
```

### Owner-Web Health
```bash
curl https://lego-bot-ownerweb.vercel.app/api/health
```

### Database Health
```sql
SELECT 1;
```

### Redis Health
```bash
redis-cli PING
```
