'use client';

import { useQuery } from '@tanstack/react-query';
import { openBotInOwnerWeb, openOwnerWebCabinet } from '../utils/ownerWeb';
import { Bot, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

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

  const bots = data?.bots;

  const handleOpenBot = async (botId: string) => {
    try {
      await openBotInOwnerWeb(botId, 'overview');
    } catch (err) {
      toast.error('Не удалось открыть бота', {
        description: err instanceof Error ? err.message : 'Попробуйте позже',
      });
    }
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Боты
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {bots?.active || 0} активных / {bots?.total || 0} всего
              </p>
            </div>
            <button
              onClick={() => openOwnerWebCabinet()}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Owner Web
            </button>
          </div>
        </div>

        {/* Bots List */}
        {!bots?.items || bots.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-8 text-center">
            <Bot className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
              Нет ботов
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Создайте первого бота в Owner Web
            </p>
            <button
              onClick={() => openOwnerWebCabinet()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center gap-2 mx-auto"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть Owner Web
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {bots.items.map((bot: { id: string; name: string; isActive: boolean }) => (
              <div
                key={bot.id}
                className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {bot.isActive ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {bot.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {bot.isActive ? 'Активен' : 'Неактивен'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenBot(bot.id)}
                    className="ml-3 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Открыть
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Управление ботами</strong> (создание, редактирование, настройки) доступно в Owner Web.
          </p>
        </div>
      </div>
    </div>
  );
}

