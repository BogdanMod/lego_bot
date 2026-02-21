'use client';

import { useState } from 'react';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerSummary, ownerBots, ownerStopBot, ownerActivateBot, ownerDeleteBot, ownerFetch, type ApiError } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function CabinetIndexPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: authData } = useOwnerAuth();

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['owner-summary'],
    queryFn: ownerSummary,
    enabled: !!authData,
  });

  const { data: botsData, isLoading: botsLoading } = useQuery({
    queryKey: ['owner-bots'],
    queryFn: ownerBots,
    enabled: !!authData,
  });

  const stopMutation = useMutation({
    mutationFn: ownerStopBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      toast.success('Бот остановлен');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при остановке');
    },
  });

  const activateMutation = useMutation({
    mutationFn: ownerActivateBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      toast.success('Бот запущен');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при запуске');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ownerDeleteBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      toast.success('Бот удалён');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при удалении');
    },
  });

  if (summaryLoading || botsLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const active = authData?.botsCountVisible ?? botsData?.total ?? summary?.bots.active ?? 0;
  const limit = summary?.user.botLimit ?? 3;
  const isLimitReached = active >= limit;
  const bots = botsData?.items ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-medium text-zinc-900 dark:text-zinc-100">Мои боты</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {active} из {limit} · {isLimitReached ? 'Лимит достигнут' : 'можно создать ещё'}
          </p>
        </div>
        <button
          onClick={() => {
            if (isLimitReached) return;
            router.push('/cabinet/bots');
          }}
          disabled={isLimitReached}
          className="shrink-0 px-5 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Создать бота
        </button>
      </div>

      {isLimitReached && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm text-amber-800 dark:text-amber-200">
          Удалите бота или обновите план, чтобы создать нового.
        </div>
      )}

      {bots.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-12 text-center">
          <p className="text-zinc-600 dark:text-zinc-400 mb-4">Пока нет ботов</p>
          <button
            onClick={() => {
              if (isLimitReached) return;
              router.push('/cabinet/bots');
            }}
            disabled={isLimitReached}
            className="px-5 py-2.5 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
          >
            Создать первого бота
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <SimpleBotCard
              key={bot.botId}
              botId={bot.botId}
              name={bot.name}
              onActivate={() => activateMutation.mutate(bot.botId)}
              onStop={() => stopMutation.mutate(bot.botId)}
              onDelete={() => deleteMutation.mutate(bot.botId)}
              isActivating={activateMutation.isPending}
              isStopping={stopMutation.isPending}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Карточка бота: минималистичный стиль (Linear), скруглённые углы, кнопка «Удалить» с подтверждением
function SimpleBotCard({
  botId,
  name,
  onActivate,
  onStop,
  onDelete,
  isActivating,
  isStopping,
  isDeleting,
}: {
  botId: string;
  name: string;
  onActivate: () => void;
  onStop: () => void;
  onDelete: () => void;
  isActivating: boolean;
  isStopping: boolean;
  isDeleting: boolean;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: botData } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  const isActive = botData?.bot?.isActive || false;
  const status = botData?.status;
  const lastActivityAt = status?.lastActivityAt ?? status?.lastEventAt ?? status?.lastLeadAt ?? status?.lastOrderAt ?? null;
  const hasRecentActivity = status?.hasRecentActivity ?? false;
  const showDiagnosticHint = isActive && !hasRecentActivity;

  const formatLastActivity = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return new Date(dateStr).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete();
    setConfirmDelete(false);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1.5 text-xs ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
              {isActive ? 'Активен' : 'Остановлен'}
            </span>
          </div>
          {lastActivityAt && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Активность: {formatLastActivity(lastActivityAt)}
            </p>
          )}
          {showDiagnosticHint && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Нет активности за 24 ч. Проверьте вебхук.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => router.push(`/cabinet/${botId}/constructor`)}
          className="px-3 py-2 text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          Редактировать
        </button>
        <button
          onClick={() => router.push(`/cabinet/${botId}/analytics`)}
          className="px-3 py-2 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Аналитика
        </button>
        <button
          onClick={isActive ? onStop : onActivate}
          disabled={isActivating || isStopping}
          className="px-3 py-2 text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isActive ? 'Остановить' : 'Запустить'}
        </button>
        <button
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className={`ml-auto px-3 py-2 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${
            confirmDelete
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
          }`}
          title="Удалить бота"
        >
          {confirmDelete ? 'Подтвердить удаление' : 'Удалить'}
        </button>
      </div>
    </div>
  );
}
