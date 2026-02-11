# Owner Cabinet Runbook

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

### Check Session (if using Redis sessions)
```bash
redis-cli GET "owner:session:<sessionId>"
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

### Structured Logs
All logs include:
- `request_id`
- `userId` (for owner requests)
- `botId` (for bot-scoped requests)
- `route` (API path)

Search pattern:
```
request_id:abc123 userId:123456789 botId:xyz
```

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
