'use client';

import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerFetch, ownerDeactivateBot, type ApiError } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bot, Activity, Trash2 } from 'lucide-react';
import { useWorkMode } from '@/contexts/mode-context';
import { toast } from 'sonner';

interface BotCardProps {
  botId: string;
  name: string;
}

export function BotCard({ botId, name }: BotCardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mode } = useWorkMode();

  // Fetch bot summary for statistics (only in manage mode)
  const { data: summary, isLoading } = useQuery({
    queryKey: ['bot-summary', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/summary`),
    staleTime: 30_000, // Cache for 30 seconds
    enabled: mode === 'manage', // Only fetch in manage mode
  });

  const deleteMutation = useMutation({
    mutationFn: ownerDeactivateBot,
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
        // Navigate based on mode
        if (mode === 'edit') {
          router.push(`/cabinet/${botId}/constructor?mode=edit`);
        } else {
          router.push(`/cabinet/${botId}?mode=manage`);
        }
      }}
      className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">
              {name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              {isLoading ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <Badge variant={status === 'active' ? 'success' : 'default'} className="text-xs">
                  {status === 'active' ? 'Active' : 'Paused'}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Show statistics only in manage mode */}
      {mode === 'manage' && (
        isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4" />
                <span className="font-medium text-slate-900 dark:text-slate-100">{leadsCount}</span>
                <span className="text-slate-500">заявок</span>
              </div>
              {ordersCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{ordersCount}</span>
                  <span className="text-slate-500">заказов</span>
                </div>
              )}
            </div>
          </div>
        )
      )}

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            // Navigate based on mode
            if (mode === 'edit') {
              router.push(`/cabinet/${botId}/constructor?mode=edit`);
            } else {
              router.push(`/cabinet/${botId}?mode=manage`);
            }
          }}
          className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Открыть
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Удалить бота"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

