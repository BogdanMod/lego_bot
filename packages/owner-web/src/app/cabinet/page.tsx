'use client';

import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerSummary, ownerBots, ownerDeactivateBot, ownerActivateBot, ownerFetch, type ApiError } from '@/lib/api';
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

  const deactivateMutation = useMutation({
    mutationFn: ownerDeactivateBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      toast.success('Бот успешно остановлен');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при остановке бота');
    },
  });

  const activateMutation = useMutation({
    mutationFn: ownerActivateBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      toast.success('Бот успешно запущен');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при запуске бота');
    },
  });

  if (summaryLoading || botsLoading) {
    return (
      <div className="panel p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const active = authData?.botsCountVisible ?? botsData?.total ?? summary?.bots.active ?? 0;
  const limit = summary?.user.botLimit ?? 3;
  const isLimitReached = active >= limit;
  const bots = botsData?.items ?? [];

  return (
    <div className="panel p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Мои боты</h1>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-muted-foreground">
            Боты: <span className="font-medium">{active}/{limit}</span>
          </div>
          {isLimitReached && (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              Лимит достигнут. Удалите бота или обновите план.
            </div>
          )}
        </div>
        <button
          onClick={() => {
            if (isLimitReached) return;
            router.push('/cabinet/bots');
          }}
          disabled={isLimitReached}
          className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
        >
          Создать бота
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">У вас пока нет ботов. Создайте первого бота, чтобы начать.</p>
          <button
            onClick={() => {
              if (isLimitReached) return;
              router.push('/cabinet/bots');
            }}
            disabled={isLimitReached}
            className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
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
              onDeactivate={() => deactivateMutation.mutate(bot.botId)}
              isActivating={activateMutation.isPending}
              isDeactivating={deactivateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Simplified bot card component
function SimpleBotCard({ 
  botId, 
  name,
  onActivate,
  onDeactivate,
  isActivating,
  isDeactivating,
}: { 
  botId: string; 
  name: string;
  onActivate: () => void;
  onDeactivate: () => void;
  isActivating: boolean;
  isDeactivating: boolean;
}) {
  const router = useRouter();
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

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{name}</h3>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isActive ? 'Активен' : 'Остановлен'}
          </div>
          {lastActivityAt && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Последняя активность: {formatLastActivity(lastActivityAt)}
            </div>
          )}
          {showDiagnosticHint && (
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Запущен, но активности нет. Проверьте вебхук и аналитику.
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/cabinet/${botId}/constructor`)}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Редактировать
        </button>
        <button
          onClick={() => router.push(`/cabinet/${botId}/analytics`)}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Аналитика
        </button>
        <button
          onClick={isActive ? onDeactivate : onActivate}
          disabled={isActivating || isDeactivating}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {isActive ? 'Остановить' : 'Запустить'}
        </button>
      </div>
    </div>
  );
}
