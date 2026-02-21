'use client';

import { useQuery } from '@tanstack/react-query';
import { openOwnerWebCabinet } from '../utils/ownerWeb';

function overviewQueryFn() {
  const tg = window.Telegram?.WebApp;
  const userId = tg?.initDataUnsafe?.user?.id;
  let initData: string | undefined = tg?.initData;
  if (!initData && tg?.initDataUnsafe) initData = (tg as any).initData ?? '';
  if (!userId || !initData) throw new Error('Telegram auth required');
  const apiUrl = import.meta.env.DEV
    ? import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000'
    : import.meta.env.VITE_API_URL || 'https://core-production.up.railway.app';
  return fetch(`${apiUrl}/api/miniapp/overview?user_id=${userId}`, {
    headers: { 'X-Telegram-Init-Data': initData, 'Content-Type': 'application/json' },
  }).then((r) => {
    if (!r.ok) throw new Error(r.status === 401 ? 'Сессия истекла. Закройте и откройте бота снова.' : `Ошибка ${r.status}`);
    return r.json();
  });
}

export default function BotsPage() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['miniapp-overview'],
    queryFn: overviewQueryFn,
    retry: 3,
    retryDelay: (i) => Math.min(600 * 2 ** i, 3000),
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  if (isLoading && !isRefetching) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-slate-500 dark:text-slate-400">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="text-sm text-red-500 mb-2">Ошибка загрузки</div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{(error as Error).message}</p>
          <button onClick={() => refetch()} disabled={isRefetching} className="text-sm text-blue-500 dark:text-blue-400 underline disabled:opacity-50">
            {isRefetching ? 'Загрузка…' : 'Обновить'}
          </button>
          <span className="text-slate-400 mx-2">или</span>
          <button onClick={() => window.location.reload()} className="text-sm text-slate-500 dark:text-slate-400 underline">
            перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }

  const bots = data?.bots;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6 pb-20">
        {/* Brand */}
        <div className="text-center space-y-0.5">
          <div className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wider">
            Zer | Con
          </div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500">
            Zero Context System
          </div>
        </div>

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Боты
          </h1>
        </div>

        {/* Bots List */}
        {!bots?.items || bots.items.length === 0 ? (
          <div className="text-center py-12">
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
          <div className="space-y-1">
            {bots.items.map((bot: { id: string; name: string; isActive: boolean }) => (
              <div
                key={bot.id}
                className="py-3 border-b border-slate-200 dark:border-slate-800 last:border-0"
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
