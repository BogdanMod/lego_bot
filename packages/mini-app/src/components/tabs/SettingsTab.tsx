import { useState } from 'react';
import { Bell, ChevronRight, LogOut, Moon, Shield, ShieldCheck, Sun, Ticket, User, Wallet } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { useProjects } from '../../contexts/ProjectsContext';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { isAdminUser } from '../../constants/admin';
import { api, formatApiError } from '../../utils/api';

const WebApp = window.Telegram?.WebApp;

export function SettingsTab() {
  const navigate = useNavigate();
  const { subscription, setSubscription } = useProjects();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isAdmin = isAdminUser();
  const [promoCode, setPromoCode] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoResult, setPromoResult] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const handleRedeemPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('Введите промокод');
      return;
    }
    setPromoBusy(true);
    setPromoResult(null);
    setPromoError(null);
    try {
      const result = await api.redeemPromoCode({ code: promoCode.trim() });
      if (result.plan.toLowerCase() === 'premium') {
        setSubscription('Premium');
      }
      const ends = result.endsAt ? new Date(result.endsAt).toLocaleDateString() : 'без срока';
      setPromoResult(`Промокод активирован. Подписка до ${ends}.`);
      setPromoCode('');
    } catch (error) {
      setPromoError(formatApiError(error));
    } finally {
      setPromoBusy(false);
    }
  };

  return (
    <div className="px-4 pt-6">
      <div className="text-2xl font-semibold text-slate-900 dark:text-white">{t.settings.title}</div>

      <div className="mt-6 space-y-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <User size={22} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-slate-900 dark:text-white">{t.settings.profileName}</div>
                <Badge variant="info" size="sm">
                  {subscription}
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{t.settings.theme}</div>
            <button
              onClick={toggleTheme}
              className="flex items-center rounded-full border p-1 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              aria-label={t.settings.theme}
            >
              <span
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                  theme === 'light'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                <Sun size={16} />
              </span>
              <span
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full transition-all',
                  theme === 'dark'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400',
                ].join(' ')}
              >
                <Moon size={16} />
              </span>
            </button>
          </div>
        </Card>

        <Card onClick={() => {}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield size={18} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.settings.security}</span>
            </div>
            <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
          </div>
        </Card>

        <Card onClick={() => {}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.settings.billing}</span>
            </div>
            <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
          </div>
        </Card>

        <Card>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Ticket size={18} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Активировать промокод</span>
            </div>
            <Input
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value)}
              placeholder="Введите код"
              disabled={promoBusy}
              error={promoError || undefined}
            />
            {promoResult ? (
              <div className="text-sm text-emerald-600 dark:text-emerald-400">{promoResult}</div>
            ) : null}
            <Button onClick={() => void handleRedeemPromo()} disabled={promoBusy}>
              {promoBusy ? 'Активируем...' : 'Активировать'}
            </Button>
          </div>
        </Card>

        <Card onClick={() => {}}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={18} className="text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.settings.notifications}</span>
            </div>
            <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
          </div>
        </Card>

        {isAdmin ? (
          <Card onClick={() => navigate('/admin')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">Админ панель</span>
              </div>
              <ChevronRight size={18} className="text-slate-400 dark:text-slate-500" />
            </div>
          </Card>
        ) : null}

        <div className="pt-2">
          <Button
            variant="danger"
            className="w-full"
            icon={<LogOut size={18} />}
            onClick={() => WebApp?.close()}
          >
            {t.settings.logout}
          </Button>
        </div>
      </div>
    </div>
  );
}
