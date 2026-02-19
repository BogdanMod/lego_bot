'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Bot, Activity } from 'lucide-react';
import { useWorkMode } from '@/contexts/mode-context';

interface BotCardProps {
  botId: string;
  name: string;
}

export function BotCard({ botId, name }: BotCardProps) {
  const router = useRouter();
  const { mode } = useWorkMode();

  // Fetch bot summary for statistics (only in manage mode)
  const { data: summary, isLoading } = useQuery({
    queryKey: ['bot-summary', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/summary`),
    staleTime: 30_000, // Cache for 30 seconds
    enabled: mode === 'manage', // Only fetch in manage mode
  });

  const leadsCount = summary?.kpi?.newLeads7d ?? 0;
  const ordersCount = summary?.kpi?.orders7d ?? 0;
  const status = summary?.eventsSummary ? 'active' : 'paused'; // Simplified: if has events, it's active

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

      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
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
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          Открыть
        </button>
      </div>
    </div>
  );
}

