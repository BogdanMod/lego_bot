'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface AnalyticsTabProps {
  botId: string;
}

export function AnalyticsTab({ botId }: AnalyticsTabProps) {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['bot-summary', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/summary`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Ошибка загрузки"
        description="Не удалось загрузить аналитику. Попробуйте обновить страницу."
      />
    );
  }

  const kpi = summary?.kpi || {};
  const eventsSummary = summary?.eventsSummary || {};

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Новых заявок (7д)</div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {kpi.newLeads7d || 0}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Заказов (7д)</div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {kpi.orders7d || 0}
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Выручка (30д)</div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {kpi.revenue30d || 0} ₽
          </div>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Конверсия</div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {kpi.conversion ? `${kpi.conversion}%` : '—'}
          </div>
        </div>
      </div>

      {/* Events Summary */}
      {eventsSummary.total && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">События</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Всего</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {eventsSummary.total || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Новые</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {eventsSummary.new || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">В работе</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {eventsSummary.inProgress || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Завершено</div>
              <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {eventsSummary.completed || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {!summary && (
        <EmptyState
          title="Нет данных"
          description="Аналитика будет доступна после начала работы бота."
        />
      )}
    </div>
  );
}

