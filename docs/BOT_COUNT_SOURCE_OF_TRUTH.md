# Bot Count Source of Truth

## ADR: Single Source of Truth for Bot Count

**Decision:** `countOwnerAccessibleBots(telegramUserId)` is the single source of truth for bot count in owner-web.

**Rationale:**
- RBAC-based: Counts through `bot_admins` table (multi-user support)
- Consistent filters: `is_active=true AND deleted_at IS NULL`
- Prevents duplicates: Uses `COUNT(DISTINCT b.id)`
- Matches items: `getOwnerAccessibleBots().length === countOwnerAccessibleBots()` always

## Implementation

### Functions

**`getOwnerAccessibleBots(telegramUserId)`**
- Returns: `OwnerBotAccess[]`
- Filters: `b.is_active = true AND b.deleted_at IS NULL`
- Uses: `DISTINCT ON (b.id)` to prevent duplicates
- Purpose: Get list of accessible bots

**`countOwnerAccessibleBots(telegramUserId)`** ⭐ **SOURCE OF TRUTH**
- Returns: `number`
- Filters: `b.is_active = true AND b.deleted_at IS NULL` (identical to `getOwnerAccessibleBots`)
- Uses: `COUNT(DISTINCT b.id)` to prevent duplicates
- Purpose: Get count of accessible bots

### API Endpoints

**`GET /api/owner/auth/me`**
- Returns: `{ bots: Bot[], botsCountVisible: number }`
- `botsCountVisible`: From `countOwnerAccessibleBots()` ⭐

**`GET /api/owner/bots`**
- Returns: `{ items: Bot[], total: number }`
- `total`: From `countOwnerAccessibleBots()` ⭐

**`GET /api/owner/summary`**
- Returns: `{ bots: { active: number, total: number } }`
- `active`: From `countOwnerAccessibleBots()` ⭐
- `total`: From `getBotStatsByUserId()` (includes inactive, for reference)

## Rules

1. **Never use `.length` for bot count** - Always use `countOwnerAccessibleBots()`
2. **Filters must be identical** - Both functions use same WHERE clause
3. **Items and count must match** - `items.length === countOwnerAccessibleBots()` always
4. **Debug endpoint** - `/api/debug/owner` compares all sources

## Debug Endpoint

`GET /api/debug/owner` (dev/staging/test only)

Returns comparison:
- `sourceOfTruth.countFunction` - `countOwnerAccessibleBots()`
- `itemsArray.accessibleBotsLength` - `getOwnerAccessibleBots().length`
- `itemsArray.distinctItemsCount` - `new Set(items.map(id)).size`
- `duplicates.rawDuplicatesInBotAdmins` - Raw duplicates in `bot_admins` table

## Migration Notes

- All `.length` usages replaced with `countOwnerAccessibleBots()`
- All API endpoints updated to use source of truth
- UI updated to use `botsCountVisible` or `total` from API

