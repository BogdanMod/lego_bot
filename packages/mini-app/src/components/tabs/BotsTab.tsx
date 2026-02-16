import { useState } from 'react';
import { Bot, Edit2, ExternalLink, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { useLanguage } from '../../hooks/useLanguage';
import { api } from '../../utils/api';
import type { BotSummary } from '../../types';
import { openBotInOwnerWeb, openOwnerWebCreateBot } from '../../utils/ownerWeb';

export function BotsTab() {
  const { t } = useLanguage();
  const [retryCount, setRetryCount] = useState(0);
  const [loadingBotId, setLoadingBotId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: botsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['bots', retryCount],
    queryFn: () => api.getBots({ limit: 100 }),
    retry: (failureCount, error: any) => {
      // Don't retry on 401/403 (auth errors)
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const bots = botsData?.bots || [];
  const isLoadingBots = isLoading;
  const hasError = isError;

  // Handle auth errors
  const isAuthError = error && (
    (error as any)?.response?.status === 401 ||
    (error as any)?.response?.status === 403 ||
    (error as any)?.message?.includes('401') ||
    (error as any)?.message?.includes('403')
  );

  // Handle network errors
  const isNetworkError = error && (
    (error as any)?.name === 'ApiNetworkError' ||
    (error as any)?.message?.includes('network') ||
    (error as any)?.message?.includes('fetch')
  );

  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
    refetch();
  };

  const handleEdit = async (bot: BotSummary) => {
    if (loadingBotId === bot.id) return;
    setLoadingBotId(bot.id);
    try {
      await openBotInOwnerWeb(bot.id, 'settings', true);
    } catch (error) {
      console.error('[BotsTab] Failed to open bot in owner-web:', error);
      // Error is already shown via toast in openOwnerWebViaBotlink
    } finally {
      setLoadingBotId(null);
    }
  };

  const handleOpen = async (bot: BotSummary) => {
    if (loadingBotId === bot.id) return;
    setLoadingBotId(bot.id);
    try {
      // TODO: If bot has a public URL or mini-app URL, open it
      // For now, just open in owner-web
      await openBotInOwnerWeb(bot.id, 'overview', true);
    } catch (error) {
      console.error('[BotsTab] Failed to open bot in owner-web:', error);
      // Error is already shown via toast in openOwnerWebViaBotlink
    } finally {
      setLoadingBotId(null);
    }
  };

  const handleCreate = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await openOwnerWebCreateBot(true);
    } catch (error) {
      console.error('[BotsTab] Failed to open create bot:', error);
      // Error is already shown via toast in openOwnerWebViaBotlink
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    } catch {
      return '';
    }
  };

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-white">{t.bots.title}</div>
          {!isLoadingBots && bots.length > 0 && (
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Всего ботов: {bots.length}
            </div>
          )}
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          onClick={handleCreate}
          disabled={isCreating}
        >
          {t.bots.create}
        </Button>
      </div>

      {/* Loading state */}
      {isLoadingBots && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-slate-500 dark:text-slate-400">Загрузка ботов...</div>
        </div>
      )}

      {/* Auth error */}
      {!isLoadingBots && isAuthError && (
        <Card className="rounded-[2.25rem] p-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Требуется авторизация
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Откройте Mini App из Telegram для доступа к вашим ботам
            </div>
            <Button variant="secondary" onClick={handleRetry}>
              Повторить
            </Button>
          </div>
        </Card>
      )}

      {/* Network error */}
      {!isLoadingBots && !isAuthError && isNetworkError && (
        <Card className="rounded-[2.25rem] p-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              Ошибка подключения
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              Не удалось загрузить список ботов. Проверьте подключение к интернету.
            </div>
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleRetry}>
              Повторить
            </Button>
          </div>
        </Card>
      )}

      {/* Generic error */}
      {!isLoadingBots && !isAuthError && !isNetworkError && hasError && (
        <Card className="rounded-[2.25rem] p-6">
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">
              Ошибка загрузки
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-4">
              {(error as any)?.message || 'Неизвестная ошибка'}
            </div>
            <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handleRetry}>
              Повторить
            </Button>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!isLoadingBots && !hasError && bots.length === 0 && (
        <Card className="rounded-[2.25rem] p-8">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Bot size={32} />
              </div>
            </div>
            <div className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
              {t.bots.emptyTitle}
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              {t.bots.emptyHint}
            </div>
            <Button
              variant="primary"
              icon={isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              onClick={handleCreate}
              disabled={isCreating}
            >
              {t.bots.createInCabinet}
            </Button>
          </div>
        </Card>
      )}

      {/* Bots list */}
      {!isLoadingBots && !hasError && bots.length > 0 && (
        <div className="flex flex-col gap-4">
          {bots.map((bot) => (
            <Card key={bot.id} className="rounded-[2.25rem]">
              <div className="flex items-start gap-4 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <Bot size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-semibold text-slate-900 dark:text-white truncate">
                        {bot.name || 'Без названия'}
                      </div>
                      {bot.created_at && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Создан: {formatDate(bot.created_at)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {bot.webhook_set ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          Активен
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Черновик
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={loadingBotId === bot.id ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
                      onClick={() => handleEdit(bot)}
                      disabled={loadingBotId === bot.id}
                    >
                      {t.bots.edit}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={loadingBotId === bot.id ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                      onClick={() => handleOpen(bot)}
                      disabled={loadingBotId === bot.id}
                    >
                      {t.bots.open}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

