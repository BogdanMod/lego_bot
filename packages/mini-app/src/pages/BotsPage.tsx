'use client';

import { useQuery } from '@tanstack/react-query';
import { openOwnerWebCabinet } from '../utils/ownerWeb';

export default function BotsPage() {
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

  const bots = data?.bots;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Боты
          </h1>
        </div>

        {/* Bots List */}
        {!bots?.items || bots.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
              Нет ботов
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Создайте первого бота в Owner Web
            </div>
            <button
              onClick={() => openOwnerWebCabinet()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              Открыть панель управления
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {bots.items.map((bot: { id: string; name: string; username?: string; isActive: boolean }) => (
              <div
                key={bot.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {bot.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {bot.isActive ? 'Активен' : 'Остановлен'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-4">
          <button
            onClick={() => openOwnerWebCabinet()}
            className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
          >
            Открыть панель управления
          </button>
        </div>
      </div>
    </div>
  );
}
