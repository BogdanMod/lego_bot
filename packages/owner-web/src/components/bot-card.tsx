'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerFetch, ownerDeleteBot, type ApiError } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface BotCardProps {
  botId: string;
  name: string;
}

export function BotCard({ botId, name }: BotCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch bot summary for statistics
  const { data: summary, isLoading } = useQuery({
    queryKey: ['bot-summary', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/summary`),
    staleTime: 30_000, // Cache for 30 seconds
  });

  const deleteMutation = useMutation({
    mutationFn: ownerDeleteBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      queryClient.invalidateQueries({ queryKey: ['miniapp-overview'] }); // Invalidate Mini App cache
      toast.success('Бот успешно удален');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при удалении бота');
    },
  });

  const leadsCount = summary?.kpi?.newLeads7d ?? 0;
  const ordersCount = summary?.kpi?.orders7d ?? 0;
  const status = summary?.eventsSummary ? 'active' : 'paused'; // Simplified: if has events, it's active

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirmed = await new Promise<boolean>((resolve) => {
      toast(
        <div className="flex flex-col gap-3">
          <div className="font-medium">Удалить бота?</div>
          <div className="text-sm text-muted-foreground">
            Бот "{name}" будет удален. Это действие нельзя отменить.
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                toast.dismiss();
                resolve(true);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
            >
              Удалить
            </button>
            <button
              onClick={() => {
                toast.dismiss();
                resolve(false);
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
            >
              Отмена
            </button>
          </div>
        </div>,
        {
          duration: Infinity,
          id: `delete-${botId}`,
        }
      );
    });

    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(botId);
    } catch (error) {
      console.error('Failed to delete bot:', error);
      // Error is already shown via toast in onError
    }
  };

  return (
    <div
      onClick={() => {
        router.push(`/cabinet/${botId}/analytics`);
      }}
      className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Bot className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
              {name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {isLoading ? (
                <Skeleton className="h-4 w-16 rounded-lg" />
              ) : (
                <span className={`text-xs ${status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                  {status === 'active' ? 'Активен' : 'Остановлен'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4 rounded-lg" />
        </div>
      ) : (
        <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          <span>{leadsCount} заявок</span>
          {ordersCount > 0 && <span>{ordersCount} заказов</span>}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/cabinet/${botId}/analytics`); }}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
        >
          Аналитика
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/cabinet/${botId}/constructor`); }}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          Редактировать
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="px-3 py-2 text-sm font-medium rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-50"
          title="Удалить бота"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

