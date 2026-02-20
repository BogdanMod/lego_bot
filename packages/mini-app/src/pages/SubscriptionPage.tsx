'use client';

import { useQuery } from '@tanstack/react-query';
import { openOwnerWebCabinet } from '../utils/ownerWeb';

export default function SubscriptionPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['miniapp-overview'],
    queryFn: async () => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-sm text-red-500 mb-2">Ошибка загрузки</div>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-slate-500 dark:text-slate-400 underline"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  const subscription = data?.subscription;
  const bots = data?.bots;

  const planName = subscription?.plan === 'free' ? 'Free' : 'Premium';
  const isActive = subscription?.isActive || false;
  const activeBots = bots?.active || 0;
  const totalBots = bots?.total || 0;
  const botLimit = bots?.limit || 3;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-md mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Подписка
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Управление тарифом и лимитами
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-6">
          {/* Plan Info */}
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Текущий тариф
              </div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {planName}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Статус
              </div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {isActive ? 'Активен' : 'Неактивен'}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Активных ботов
              </div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {activeBots} из {botLimit}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Всего создано
              </div>
              <div className="text-lg font-medium text-slate-900 dark:text-slate-100">
                {totalBots}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <button
              onClick={() => openOwnerWebCabinet()}
              className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              Повысить тариф
            </button>
            <button
              onClick={() => openOwnerWebCabinet()}
              className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Открыть панель управления
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="pt-4">
          <button
            onClick={() => {
              const supportUrl = 'https://t.me/your_support_bot';
              const webApp = window.Telegram?.WebApp as any;
              if (webApp?.openLink && typeof webApp.openLink === 'function') {
                webApp.openLink(supportUrl);
              } else {
                window.open(supportUrl, '_blank');
              }
            }}
            className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Поддержка
          </button>
        </div>
      </div>
    </div>
  );
}
