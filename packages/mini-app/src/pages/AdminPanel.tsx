import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, ShieldAlert } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { api, formatApiError } from '../utils/api';
import type { AdminStats, PromoCode, MaintenanceState } from '../types';
import { isAdminUser } from '../constants/admin';

type PromoFormState = {
  code: string;
  durationDays: string;
  maxRedemptions: string;
  expiresAt: string;
};

type GrantFormState = {
  telegramUserId: string;
  durationDays: string;
  plan: string;
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const isAdmin = useMemo(() => isAdminUser(), []);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState<PromoFormState>({
    code: '',
    durationDays: '30',
    maxRedemptions: '1',
    expiresAt: '',
  });
  const [grantForm, setGrantForm] = useState<GrantFormState>({
    telegramUserId: '',
    durationDays: '30',
    plan: 'premium',
  });
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [grantSuccess, setGrantSuccess] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, promoData, maintenanceData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminPromoCodes(),
        api.getAdminMaintenanceStatus(),
      ]);
      setStats(statsData);
      setPromoCodes(promoData.items);
      setMaintenance(maintenanceData);
      setMaintenanceMessage(maintenanceData.message || '');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      void loadAll();
    }
  }, [isAdmin]);

  const handleCreatePromo = async () => {
    setActionBusy(true);
    setError(null);
    try {
      const durationDays = Number(promoForm.durationDays);
      const maxRedemptions = promoForm.maxRedemptions ? Number(promoForm.maxRedemptions) : undefined;
      const expiresAt = promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : undefined;
      const created = await api.createAdminPromoCode({
        code: promoForm.code.trim() || undefined,
        durationDays,
        maxRedemptions,
        expiresAt,
      });
      setPromoCodes((prev) => [created, ...prev]);
      setPromoForm({
        code: '',
        durationDays: '30',
        maxRedemptions: '1',
        expiresAt: '',
      });
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleMaintenanceToggle = async (enabled: boolean) => {
    setActionBusy(true);
    setError(null);
    try {
      const updated = await api.updateMaintenanceStatus({
        enabled,
        message: maintenanceMessage.trim() || null,
      });
      setMaintenance(updated);
      setMaintenanceMessage(updated.message || '');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setActionBusy(false);
    }
  };

  const handleGrantSubscription = async () => {
    setActionBusy(true);
    setError(null);
    setGrantSuccess(null);
    try {
      const telegramUserId = Number(grantForm.telegramUserId);
      const durationDays = Number(grantForm.durationDays);
      if (!Number.isFinite(telegramUserId) || telegramUserId <= 0) {
        throw new Error('Введите корректный Telegram User ID');
      }
      if (!Number.isFinite(durationDays) || durationDays < 1) {
        throw new Error('Введите корректный срок подписки (дни)');
      }
      const result = await api.grantAdminSubscription({
        telegramUserId,
        durationDays,
        plan: grantForm.plan.trim() || 'premium',
      });
      const ends = result.endsAt ? new Date(result.endsAt).toLocaleDateString() : 'без срока';
      setGrantSuccess(`Подписка для ${result.telegramUserId} продлена до ${ends}.`);
      setGrantForm((prev) => ({ ...prev, telegramUserId: '' }));
      const refreshedStats = await api.getAdminStats();
      setStats(refreshedStats);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setActionBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen px-4 pt-6 text-slate-800 dark:text-slate-100">
        <button
          className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={16} />
          Назад
        </button>
        <Card>
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} className="text-rose-500" />
            <div>
              <div className="text-base font-semibold">Недостаточно прав</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Эта панель доступна только для администраторов.
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-24 text-slate-900 dark:text-white">
      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={16} />
          Назад
        </button>
        <button
          className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800"
          onClick={() => void loadAll()}
        >
          <RefreshCw size={14} />
          Обновить
        </button>
      </div>

      <div className="mt-4 text-2xl font-semibold">Админ панель</div>
      {maintenance?.enabled ? (
        <div className="mt-2">
          <Badge variant="warning">Технические работы включены</Badge>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Всего пользователей</div>
          <div className="mt-2 text-2xl font-semibold">{stats?.totalUsers ?? (loading ? '...' : '0')}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Активные (7 дней)</div>
          <div className="mt-2 text-2xl font-semibold">{stats?.activeUsersLast7d ?? (loading ? '...' : '0')}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Новые (7 дней)</div>
          <div className="mt-2 text-2xl font-semibold">{stats?.joinedLast7d ?? (loading ? '...' : '0')}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Новые (30 дней)</div>
          <div className="mt-2 text-2xl font-semibold">{stats?.joinedLast30d ?? (loading ? '...' : '0')}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Подписки активны</div>
          <div className="mt-2 text-2xl font-semibold">{stats?.activeSubscriptions ?? (loading ? '...' : '0')}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Платящих подписок</div>
          <div className="mt-2 text-2xl font-semibold">{stats?.paidSubscriptions ?? (loading ? '...' : '0')}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Retention D1</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '...' : `${stats?.retentionDay1 ?? 0}%`}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Retention D7</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '...' : `${stats?.retentionDay7 ?? 0}%`}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Retention D30</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '...' : `${stats?.retentionDay30 ?? 0}%`}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Conversion to paid</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '...' : `${stats?.conversionToPaid ?? 0}%`}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">ARPU (30d, USD)</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '...' : `$${stats?.arpuUsd30d ?? 0}`}</div>
        </Card>
        <Card>
          <div className="text-xs text-slate-500 dark:text-slate-400">Revenue (30d, USD)</div>
          <div className="mt-2 text-2xl font-semibold">{loading ? '...' : `$${stats?.estimatedRevenueUsd30d ?? 0}`}</div>
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        <div className="text-lg font-semibold">Ручная выдача подписки</div>
        <Card>
          <div className="space-y-3">
            <Input
              label="Telegram User ID"
              type="number"
              value={grantForm.telegramUserId}
              onChange={(event) => setGrantForm((prev) => ({ ...prev, telegramUserId: event.target.value }))}
              placeholder="123456789"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Срок, дней"
                type="number"
                min={1}
                value={grantForm.durationDays}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, durationDays: event.target.value }))}
              />
              <Input
                label="План"
                value={grantForm.plan}
                onChange={(event) => setGrantForm((prev) => ({ ...prev, plan: event.target.value }))}
              />
            </div>
            {grantSuccess ? (
              <div className="text-sm text-emerald-600 dark:text-emerald-400">{grantSuccess}</div>
            ) : null}
            <Button onClick={() => void handleGrantSubscription()} disabled={actionBusy}>
              Выдать подписку
            </Button>
          </div>
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        <div className="text-lg font-semibold">Промокоды</div>
        <Card>
          <div className="space-y-3">
            <Input
              label="Код (если пусто — сгенерируем)"
              value={promoForm.code}
              onChange={(event) => setPromoForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="LEGO2026"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Длительность, дней"
                type="number"
                min={1}
                value={promoForm.durationDays}
                onChange={(event) => setPromoForm((prev) => ({ ...prev, durationDays: event.target.value }))}
              />
              <Input
                label="Макс. использований"
                type="number"
                min={1}
                value={promoForm.maxRedemptions}
                onChange={(event) => setPromoForm((prev) => ({ ...prev, maxRedemptions: event.target.value }))}
              />
            </div>
            <Input
              label="Истекает (дата)"
              type="date"
              value={promoForm.expiresAt}
              onChange={(event) => setPromoForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
            />
            <Button onClick={() => void handleCreatePromo()} disabled={actionBusy}>
              Создать промокод
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          {promoCodes.length === 0 && !loading ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Промокодов пока нет.</div>
          ) : null}
          {promoCodes.map((promo) => (
            <Card key={promo.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{promo.code}</div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {promo.durationDays} дней • использовано {promo.redemptionCount}/{promo.maxRedemptions}
                  </div>
                  {promo.expiresAt ? (
                    <div className="mt-1 text-xs text-slate-400">До {new Date(promo.expiresAt).toLocaleDateString()}</div>
                  ) : null}
                </div>
                <Badge variant={promo.isActive ? 'success' : 'warning'}>
                  {promo.isActive ? 'Активен' : 'Выключен'}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div className="text-lg font-semibold">Технические работы</div>
        <Card>
          <div className="space-y-3">
            <Input
              label="Сообщение пользователям"
              value={maintenanceMessage}
              onChange={(event) => setMaintenanceMessage(event.target.value)}
              placeholder="Мы обновляем сервис, попробуйте позже."
            />
            <div className="flex flex-col gap-2">
              <Button
                variant={maintenance?.enabled ? 'secondary' : 'primary'}
                onClick={() => void handleMaintenanceToggle(true)}
                disabled={actionBusy}
              >
                Включить техработы
              </Button>
              <Button
                variant="danger"
                onClick={() => void handleMaintenanceToggle(false)}
                disabled={actionBusy}
              >
                Выключить техработы
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
