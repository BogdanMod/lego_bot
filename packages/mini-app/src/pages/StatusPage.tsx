'use client';

import { useQuery } from '@tanstack/react-query';
import { openOwnerWebCabinet } from '../utils/ownerWeb';

export default function StatusPage() {
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

  const isActive = subscription?.isActive || false;
  const activeBots = bots?.active || 0;
  const botLimit = bots?.limit || 3;
  const canCreateMore = botLimit - activeBots;
  const isLimitReached = activeBots >= botLimit;

  // Determine system status
  let statusText = 'Всё работает';
  let statusColor = 'text-green-600 dark:text-green-400';
  
  if (!isActive) {
    statusText = 'Подписка не активна';
    statusColor = 'text-amber-600 dark:text-amber-400';
  } else if (isLimitReached) {
    statusText = 'Лимит достигнут';
    statusColor = 'text-amber-600 dark:text-amber-400';
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md mx-auto px-4 py-8 space-y-8 pb-20">
        {/* Brand */}
        <div className="text-center space-y-0.5">
          <div className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider">
            Zer | Con
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            Zero Context System
          </div>
        </div>

        {/* System Status */}
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className={`text-3xl font-semibold ${statusColor}`}>
              {statusText}
            </div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-4">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Активных ботов
              </div>
              <div className="text-2xl font-medium text-slate-900 dark:text-slate-100">
                {activeBots}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Можно создать ещё
              </div>
              <div className={`text-2xl font-medium ${canCreateMore === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
                {canCreateMore}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => openOwnerWebCabinet()}
            className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
          >
            Повысить тариф
          </button>
          <button
            onClick={() => openOwnerWebCabinet()}
            className="w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Открыть панель управления
          </button>
        </div>

        {/* Support */}
        <div className="pt-4 text-center">
          <button
            onClick={() => {
              const supportUrl = 'https://t.me/ZER_CON';
              const webApp = window.Telegram?.WebApp as any;
              if (webApp?.openLink && typeof webApp.openLink === 'function') {
                webApp.openLink(supportUrl);
              } else {
                window.open(supportUrl, '_blank');
              }
            }}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
          >
            Поддержка
          </button>
        </div>
      </div>
    </div>
  );
}

