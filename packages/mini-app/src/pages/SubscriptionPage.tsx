'use client';

import { useQuery } from '@tanstack/react-query';
import { openOwnerWebCabinet } from '../utils/ownerWeb';
import { Calendar, CreditCard, Zap, AlertCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function SubscriptionPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['miniapp-overview'],
    queryFn: async () => {
      // Use new unified endpoint
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      const initData = window.Telegram?.WebApp?.initData;
      if (!userId || !initData) {
        throw new Error('Telegram auth required');
      }

      const apiUrl = import.meta.env.DEV
        ? import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000'
        : import.meta.env.VITE_API_URL || 'https://core-production.up.railway.app';

      const response = await fetch(
        `${apiUrl}/api/miniapp/overview?user_id=${userId}`,
        {
          headers: {
            'X-Telegram-Init-Data': initData,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load data');
      }

      return response.json();
    },
  });

  const subscription = data?.subscription;
  const bots = data?.bots;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isExpiringSoon = subscription?.endsAt
    ? new Date(subscription.endsAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
    : false;

  const handleUpgrade = () => {
    openOwnerWebCabinet().catch((err) => {
      toast.error('Не удалось открыть кабинет', {
        description: err instanceof Error ? err.message : 'Попробуйте позже',
      });
    });
  };

  const handleRenew = () => {
    openOwnerWebCabinet().catch((err) => {
      toast.error('Не удалось открыть кабинет', {
        description: err instanceof Error ? err.message : 'Попробуйте позже',
      });
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-800 border-t-slate-900 dark:border-t-slate-100 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-sm text-red-500 mb-2">Ошибка загрузки</p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="pt-6 pb-2">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Подписка
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Управление подпиской и лимитами
          </p>
        </div>

        {/* Subscription Card */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-5 h-5 text-amber-500" />
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {subscription?.plan || 'Free'}
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {subscription?.isActive ? 'Активна' : 'Неактивна'}
              </p>
            </div>
            {subscription?.isActive && (
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                Активна
              </span>
            )}
          </div>

          {subscription?.endsAt && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600 dark:text-slate-400">
                  Действует до: <span className="font-medium">{formatDate(subscription.endsAt)}</span>
                </span>
              </div>
              {isExpiringSoon && !subscription.isActive && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Подписка скоро истечет. Продлите для продолжения работы.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Limits */}
          {bots && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Активных ботов</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {bots.active} / {bots.limit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Всего ботов</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {bots.total}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {!subscription?.isActive ? (
              <button
                onClick={handleUpgrade}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Повысить план
              </button>
            ) : (
              <button
                onClick={handleRenew}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Продлить подписку
              </button>
            )}
            <button
              onClick={() => openOwnerWebCabinet()}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть Owner Web
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <button
            onClick={() => {
              const supportUrl = 'https://t.me/your_support_bot'; // TODO: Replace with actual support bot
              const webApp = window.Telegram?.WebApp as any;
              if (webApp?.openLink && typeof webApp.openLink === 'function') {
                webApp.openLink(supportUrl);
              } else {
                window.open(supportUrl, '_blank');
              }
            }}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <span>💬</span>
            Поддержка
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Управление ботами</strong> теперь доступно в Owner Web. Используйте кнопку выше для перехода.
          </p>
        </div>
      </div>
    </div>
  );
}

