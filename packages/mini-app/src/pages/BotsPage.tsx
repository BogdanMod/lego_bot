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
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-primary)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-violet-200 dark:border-violet-800 border-t-violet-500 dark:border-t-violet-400 animate-spin" />
          <div className="text-sm text-[var(--text-hint)]">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-primary)]">
        <div className="text-center max-w-xs">
          <div className="text-sm text-red-500 dark:text-red-400 mb-2">Ошибка загрузки</div>
          <p className="text-xs text-[var(--text-secondary)] mb-3">{(error as Error).message}</p>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="text-sm text-violet-600 dark:text-violet-400 font-medium underline underline-offset-2 hover:no-underline disabled:opacity-50"
          >
            {isRefetching ? 'Загрузка…' : 'Обновить'}
          </button>
          <span className="text-[var(--text-hint)] mx-2">или</span>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-[var(--text-secondary)] underline underline-offset-2 hover:text-violet-600 dark:hover:text-violet-400"
          >
            перезагрузить страницу
          </button>
        </div>
      </div>
    );
  }

  const bots = data?.bots;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6 pb-24">
        {/* Brand */}
        <div className="text-center space-y-0.5">
          <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 tracking-wider">
            Zer | Con
          </div>
          <div className="text-[10px] text-[var(--text-hint)]">
            Zero Context System
          </div>
        </div>

        {/* Header */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
          Боты
        </h1>

        {/* Bots List */}
        {!bots?.items || bots.items.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center shadow-[var(--card-shadow)]">
            <div className="text-4xl mb-3" aria-hidden>🤖</div>
            <div className="text-base font-semibold text-[var(--text-primary)] mb-1">
              Нет ботов
            </div>
            <div className="text-sm text-[var(--text-hint)] mb-5">
              Создайте первого бота в панели управления
            </div>
            <button
              onClick={() => openOwnerWebCabinet()}
              className="inline-flex px-4 py-2.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/25 dark:shadow-violet-900/30"
            >
              Открыть панель управления
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bots.items.map((bot: { id: string; name: string; isActive: boolean }) => (
              <div
                key={bot.id}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--card-shadow)] transition-all hover:shadow-[var(--shadow-sm)] hover:border-violet-200 dark:hover:border-violet-800/50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className="flex-shrink-0 w-10 h-10 rounded-xl bg-violet-500/15 dark:bg-violet-500/20 flex items-center justify-center text-lg"
                      aria-hidden
                    >
                      🤖
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {bot.name}
                      </div>
                      <span
                        className={`
                          inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full
                          ${bot.isActive
                            ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}
                        `}
                      >
                        {bot.isActive ? 'Активен' : 'Остановлен'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Button */}
        <div className="pt-2">
          <button
            onClick={() => openOwnerWebCabinet()}
            className="w-full px-4 py-3.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/25 dark:shadow-violet-900/30"
          >
            Открыть панель управления
          </button>
        </div>
      </div>
    </div>
  );
}
