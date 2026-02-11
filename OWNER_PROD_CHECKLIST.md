# Owner Cabinet Production Checklist (v2)

## Environment Variables

### Core (Vercel)
- `DATABASE_URL` - Neon Postgres connection string
- `REDIS_URL` - Upstash Redis connection string
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_SECRET_TOKEN` - Webhook secret (optional)
- `JWT_SECRET` - Secret for owner session JWT
- `OWNER_BOTLINK_SECRET` - Secret for botlink tokens (falls back to JWT_SECRET)
- `OWNER_WEB_BASE_URL` - Full URL of owner-web (e.g., https://lego-bot-ownerweb.vercel.app)
- `ENCRYPTION_KEY` - For bot token encryption
- `ADMIN_USER_IDS` - Comma-separated Telegram user IDs for admin access
- `SENTRY_DSN` - Sentry DSN for error tracking (optional)

### Owner-Web (Vercel)
- `CORE_API_ORIGIN` - Full URL of core API (e.g., https://lego-bot-core.vercel.app)
- `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` - Bot username for Login Widget (optional, botlink preferred)
- `NEXT_PUBLIC_OWNER_WEB_URL` - Full URL of owner-web (for links)
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN for error tracking (optional)

### Worker (Vercel/Server)
- `DATABASE_URL` - Neon Postgres connection string
- `REDIS_URL` - Upstash Redis connection string
- `LOG_LEVEL` - Log level (default: info)

## Deployment Order (v2)

1. **Core** - Deploy first, ensure DB migrations run (including `020_create_bot_usage_daily`)
2. **Worker** - Deploy worker service (reads from Redis Stream `events`)
3. **Owner-Web** - Deploy after core, verify CORE_API_ORIGIN is correct

## Domain Setup

- Core: `lego-bot-core.vercel.app` (or custom domain)
- Owner-Web: `lego-bot-ownerweb.vercel.app` (or custom domain)
- Ensure CORS/security headers are correct for same-origin proxy

## Telegram Bot Setup

1. Bot token from @BotFather
2. Set webhook: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://lego-bot-core.vercel.app/api/webhook`
3. Test `/cabinet` command - should return button with auth link
4. Verify botlink flow: `/cabinet` → click button → owner-web opens → auto-login

## Redis (Upstash)

- Required for botlink token deduplication (jti tracking)
- Required for session invalidation (if implemented)
- Check connection: `GET /api/owner/_debug/redis` (dev/admin only)

## Database (Neon)

### Required Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_bot_events_bot_created ON bot_events(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_bot_created ON orders(bot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_bot_start ON appointments(bot_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_customers_bot_updated ON customers(bot_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_dedup_bot_source ON event_dedup(bot_id, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_admins_bot_user ON bot_admins(bot_id, telegram_user_id);
```

### Verify Tables
- `bot_admins` - Multi-tenant access control (with `permissions_json`)
- `bot_settings` - Per-bot configuration
- `bot_events` - Event store (with `processed_at`)
- `customers`, `leads`, `orders`, `appointments` - Normalized entities
- `owner_audit_log` - Audit trail
- `bot_usage_daily` - Billing-ready usage counters (v2)

## Security Checklist (v2)

- [ ] Cookies: httpOnly, secure (prod), sameSite=Lax
- [ ] CSRF: All mutations require x-csrf-token header
- [ ] Rate limits: /api/owner/auth/* endpoints
- [ ] RBAC 2.0: All endpoints check bot_admins access + permissions
- [ ] Tenant isolation: All endpoints require botId (except /auth/* and /bots)
- [ ] Botlink: 2min TTL, Redis NX EX for deduplication
- [ ] Security headers: X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- [ ] Request ID: All responses include request_id
- [ ] Logging: No sensitive data (tokens, passwords) in logs
- [ ] Sentry: beforeSend hooks filter sensitive data

## Testing

1. **Auth Flow**
   - Telegram `/cabinet` → botlink → owner-web auto-login
   - Verify cookie `owner_session` is set
   - Verify `/api/core/owner/auth/me` returns profile + bots + csrfToken

2. **Multi-Bot**
   - Switch between bots via selector
   - Verify lastBotId persists in localStorage
   - Verify role badges show correctly

3. **Pages**
   - Overview: KPI cards, recent items
   - Inbox: Events list, status filters
   - Orders/Leads/Customers: Lists with pagination
   - Calendar: Appointments view
   - Team: Members list
   - Settings: Bot configuration
   - Audit: Change history

4. **Command Palette**
   - ⌘K opens palette
   - Search works
   - Navigation shortcuts (g i, g c, etc.)

5. **Hotkeys**
   - `/` focuses global search
   - `g i` → Inbox
   - `g c` → Customers
   - `g o` → Orders
   - `g k` → Calendar

## Monitoring

- Check Vercel logs for errors
- Monitor Redis connection (getRedisInitOutcome)
- Check Postgres connection pool stats
- Verify request_id in error responses

## Rollback Plan

1. Revert Vercel deployment to previous version
2. Check DB migrations are backward compatible
3. Verify env vars are not changed

