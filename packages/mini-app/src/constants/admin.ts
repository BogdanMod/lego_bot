const DEFAULT_ADMIN_USER_IDS = [1217607615];

export function getAdminUserIds(): number[] {
  const envIds = (import.meta.env.VITE_ADMIN_USER_IDS || '')
    .split(',')
    .map((id: string) => id.trim())
    .filter(Boolean)
    .map((id: string) => Number(id))
    .filter((id: number) => Number.isFinite(id));
  return envIds.length > 0 ? envIds : DEFAULT_ADMIN_USER_IDS;
}

export function getTelegramUserId(): number | null {
  return window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? null;
}

export function isAdminUser(): boolean {
  const userId = getTelegramUserId();
  if (!userId) return false;
  return getAdminUserIds().includes(userId);
}
