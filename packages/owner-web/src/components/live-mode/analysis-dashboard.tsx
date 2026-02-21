'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';

interface AnalysisDashboardProps {
  botId: string;
}

type Range = 'today' | '7d';

export function AnalysisDashboard({ botId }: AnalysisDashboardProps) {
  const [range, setRange] = useState<Range>('today');
  const router = useRouter();
  const queryClient = useQueryClient();

  // Fetch bot status
  const { data: botData } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  const botStatus = botData?.status || {
    isActive: false,
    webhookSet: false,
    hasToken: false,
    lastLeadAt: null,
    lastOrderAt: null,
    lastEventAt: null,
    lastActivityAt: null,
    hasRecentActivity: false,
  };

  // Fetch analytics
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard', botId, range],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/analytics?range=${range}`),
  });

  // Activate bot mutation
  const activateBotMutation = useMutation({
    mutationFn: async () => {
      const { ownerActivateBot } = await import('@/lib/api');
      return ownerActivateBot(botId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] });
      queryClient.invalidateQueries({ queryKey: ['analytics-dashboard', botId] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Ошибка загрузки"
        description="Не удалось загрузить данные. Попробуйте обновить страницу."
      />
    );
  }

  const summaryToday = data?.summaryToday || {
    leadsCount: 0,
    ordersCount: 0,
    revenuePotentialRub: 0,
    conversionPct: null,
    confirmedOrdersCount: 0,
  };

  const summary7d = data?.summary7d || {
    leadsCount: 0,
    ordersCount: 0,
    revenuePotentialRub: 0,
    avgCheckRub: null,
  };

  const latestOrders = data?.latestOrders || [];
  const latestLeads = data?.latestLeads || [];

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'new':
        return 'Новый';
      case 'confirmed':
        return 'Подтвержден';
      case 'completed':
        return 'Завершён';
      case 'cancelled':
        return 'Отменён';
      default:
        return status || 'Новый';
    }
  };

  const formatDate = (dateStr: string) => {
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

  const hasData = summaryToday.leadsCount > 0 || summaryToday.ordersCount > 0 || 
                  summary7d.leadsCount > 0 || summary7d.ordersCount > 0;

  // Determine bot status for display
  const getBotStatusInfo = () => {
    if (!botStatus.hasToken) {
      return {
        type: 'no-token' as const,
        title: 'Бот не опубликован',
        message: 'Добавьте токен бота в настройках, чтобы начать получать заявки.',
        action: {
          label: 'Перейти к настройкам',
          onClick: () => router.push(`/cabinet/${botId}/settings?mode=edit`),
        },
      };
    }

    if (!botStatus.webhookSet) {
      return {
        type: 'no-webhook' as const,
        title: 'Webhook не настроен',
        message: 'Webhook не установлен. Бот не получает события.',
        action: null,
      };
    }

    if (!botStatus.isActive) {
      return {
        type: 'inactive' as const,
        title: 'Бот сейчас остановлен',
        message: 'Запустите бота, чтобы получать заявки и видеть статистику.',
        action: {
          label: 'Запустить бота',
          onClick: () => activateBotMutation.mutate(),
        },
      };
    }

    if (!botStatus.hasRecentActivity) {
      const lastAt = botStatus.lastActivityAt ?? botStatus.lastEventAt ?? botStatus.lastLeadAt ?? botStatus.lastOrderAt;
      const lastStr = lastAt
        ? ` Последняя активность: ${new Date(lastAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
        : '';
      return {
        type: 'no-activity' as const,
        title: 'Бот запущен, но за 24 ч нет активности',
        message: `Бот активен, но за последние 24 часа не было заявок/заказов/событий.${lastStr} Проверьте вебхук и что роутер пишет события.`,
        action: null,
      };
    }

    return null;
  };

  const statusInfo = getBotStatusInfo();

  return (
    <div className="space-y-8">
      {/* Status Warning */}
      {statusInfo && (
        <div className={`p-4 border rounded-lg ${
          statusInfo.type === 'inactive' 
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
            : statusInfo.type === 'no-webhook'
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                {statusInfo.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {statusInfo.message}
              </p>
            </div>
            {statusInfo.action && (
              <button
                onClick={statusInfo.action.onClick}
                disabled={activateBotMutation.isPending}
                className="ml-4 px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                {activateBotMutation.isPending ? 'Запуск...' : statusInfo.action.label}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Обзор</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRange('today')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              range === 'today'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Сегодня
          </button>
          <button
            onClick={() => setRange('7d')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              range === '7d'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            7 дней
          </button>
        </div>
      </div>

      {!hasData && latestOrders.length === 0 && latestLeads.length === 0 ? (
        <EmptyState
          title="Нет данных за период"
          description="Запустите бота и получите первые заявки."
        />
      ) : (
        <>
          {/* KPI Cards */}
          {range === 'today' ? (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Новые заявки сегодня
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summaryToday.leadsCount}
                </div>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Новые заказы сегодня
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summaryToday.ordersCount}
                </div>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Потенциальный доход сегодня
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summaryToday.revenuePotentialRub.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Конверсия сегодня
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summaryToday.conversionPct !== null ? `${summaryToday.conversionPct}%` : '—'}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Новые заявки (7д)
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summary7d.leadsCount}
                </div>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Новые заказы (7д)
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summary7d.ordersCount}
                </div>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Потенциальный доход (7д)
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summary7d.revenuePotentialRub.toLocaleString('ru-RU')} ₽
                </div>
              </div>
              <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                  Средний чек (7д)
                </div>
                <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {summary7d.avgCheckRub !== null ? `${summary7d.avgCheckRub.toLocaleString('ru-RU')} ₽` : '—'}
                </div>
              </div>
            </div>
          )}

          {/* Info text */}
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Доход — это сумма заказов. Оплата проходит вне бота.
          </div>

          {/* Latest Orders Table */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Последние заказы
            </h3>
            {latestOrders.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg">
                Нет заказов
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Дата/время
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Сумма
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {latestOrders.map((order: any) => (
                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {order.amount ? `${Number(order.amount).toLocaleString('ru-RU')} ${order.currency || '₽'}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {getStatusLabel(order.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Latest Leads Table */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Последние заявки
            </h3>
            {latestLeads.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg">
                Нет заявок
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Дата/время
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Заголовок
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-400">
                        Статус
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {latestLeads.map((lead: any) => (
                      <tr key={lead.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {formatDate(lead.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {lead.title || lead.message || 'Без названия'}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                          {lead.status || 'Новая'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

