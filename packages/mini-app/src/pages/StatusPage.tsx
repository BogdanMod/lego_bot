'use client';

import { useQuery } from '@tanstack/react-query';
import { openOwnerWebCabinet } from '../utils/ownerWeb';

export default function StatusPage() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['miniapp-overview'],
    queryFn: async () => {
      const tg = window.Telegram?.WebApp;
      const userId = tg?.initDataUnsafe?.user?.id;
      let initData = tg?.initData;
      if (!initData && tg?.initDataUnsafe) {
        initData = (tg as any).initData ?? '';
      }
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
        throw new Error(response.status === 401 ? 'Сессия истекла. Закройте и откройте бота снова.' : `Ошибка ${response.status}`);
      }

      return response.json();
    },
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(600 * 2 ** attemptIndex, 3000),
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
          <p className="text-xs text-[var(--text-secondary)] mb-3">
            {(error as Error).message}
          </p>
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

  const subscription = data?.subscription;
  const bots = data?.bots;

  const isActive = subscription?.isActive || false;
  const activeBots = bots?.active || 0;
  const botLimit = bots?.limit || 3;
  const canCreateMore = botLimit - activeBots;
  const isLimitReached = activeBots >= botLimit;

  let statusText = 'Всё работает';
  let statusVariant: 'success' | 'warning' = 'success';

  if (!isActive) {
    statusText = 'Подписка не активна';
    statusVariant = 'warning';
  } else if (isLimitReached) {
    statusText = 'Лимит достигнут';
    statusVariant = 'warning';
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-md mx-auto px-4 py-8 space-y-8 pb-24">
        {/* Brand */}
        <div className="text-center space-y-0.5">
          <div className="text-xs font-semibold text-violet-600 dark:text-violet-400 tracking-wider">
            Zer | Con
          </div>
          <div className="text-[10px] text-[var(--text-hint)]">
            Zero Context System
          </div>
        </div>

        {/* Status badge */}
        <div className="flex justify-center">
          <span
            className={`
              inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
              ${statusVariant === 'success'
                ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'}
            `}
          >
            <span
              className={`w-2 h-2 rounded-full ${statusVariant === 'success' ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden
            />
            {statusText}
          </span>
        </div>

        {/* Metrics cards */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-violet-500 dark:text-violet-400" aria-hidden>🤖</span>
              <span className="text-xs font-medium text-[var(--text-hint)]">
                Активных ботов
              </span>
            </div>
            <div className="text-2xl font-bold tabular-nums text-[var(--text-primary)]">
              {activeBots}
            </div>
          </div>
          <div
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-violet-500 dark:text-violet-400" aria-hidden>➕</span>
              <span className="text-xs font-medium text-[var(--text-hint)]">
                Можно создать ещё
              </span>
            </div>
            <div
              className={`text-2xl font-bold tabular-nums ${canCreateMore === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--text-primary)]'}`}
            >
              {canCreateMore}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => openOwnerWebCabinet()}
            className="w-full px-4 py-3.5 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/25 dark:shadow-violet-900/30"
          >
            Повысить тариф
          </button>
          <button
            onClick={() => openOwnerWebCabinet()}
            className="w-full px-4 py-2.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 hover:underline underline-offset-2 transition-colors"
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
            className="text-xs text-[var(--text-hint)] hover:text-violet-600 dark:hover:text-violet-400 hover:underline underline-offset-2 transition-colors"
          >
            Поддержка
          </button>
        </div>
      </div>
    </div>
  );
}
