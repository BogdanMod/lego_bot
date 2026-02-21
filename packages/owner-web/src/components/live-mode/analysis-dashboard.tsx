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
    usersWroteCount: 0,
    newUsersCount: 0,
    appointmentsCount: 0,
  };

  const summary7d = data?.summary7d || {
    leadsCount: 0,
    ordersCount: 0,
    revenuePotentialRub: 0,
    avgCheckRub: null,
    usersWroteCount: 0,
    newUsersCount: 0,
    appointmentsCount: 0,
  };

  const latestOrders = data?.latestOrders || [];
  const latestLeads = data?.latestLeads || [];
  const latestAppointments = data?.latestAppointments || [];
  const contactConversionPctToday = data?.contactConversionPctToday ?? null;
  const contactConversionPct7d = data?.contactConversionPct7d ?? null;
  const lastLeadAt = data?.lastLeadAt ?? null;

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

  const leadsCount = range === 'today' ? summaryToday.leadsCount : summary7d.leadsCount;
  const appointmentsCount = range === 'today' ? summaryToday.appointmentsCount : summary7d.appointmentsCount;
  const hasData =
    summaryToday.leadsCount > 0 ||
    summaryToday.ordersCount > 0 ||
    summaryToday.usersWroteCount > 0 ||
    summaryToday.appointmentsCount > 0 ||
    summary7d.leadsCount > 0 ||
    summary7d.ordersCount > 0 ||
    summary7d.usersWroteCount > 0 ||
    summary7d.appointmentsCount > 0 ||
    latestLeads.length > 0 ||
    latestAppointments.length > 0 ||
    latestOrders.length > 0;

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

      {/* Range Selector + Последняя активность */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Обзор</h2>
          {(botStatus.lastEventAt || botStatus.lastActivityAt) && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Последняя активность: {formatDate(botStatus.lastEventAt || botStatus.lastActivityAt || '')}
            </p>
          )}
        </div>
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

      {!hasData && latestOrders.length === 0 && latestLeads.length === 0 && latestAppointments.length === 0 ? (
        <EmptyState
          title="Нет данных за период"
          description="Запустите бота и получите первые заявки."
        />
      ) : (
        <>
          {/* Чёткие метрики: не смешиваем leads и appointments */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-5 border border-border rounded-xl bg-card shadow-sm">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Пользователей написало
              </div>
              <div className="text-3xl font-semibold text-fg tabular-nums">
                {range === 'today' ? summaryToday.usersWroteCount : summary7d.usersWroteCount}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {range === 'today' ? 'за сегодня' : 'за 7 дней'}
              </div>
            </div>
            <div className="p-5 border border-border border-l-4 border-l-primary rounded-xl bg-card shadow-sm">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Конверсия в контакт
              </div>
              <div className="text-3xl font-semibold text-fg tabular-nums">
                {range === 'today'
                  ? (contactConversionPctToday != null ? `${contactConversionPctToday}%` : '—')
                  : (contactConversionPct7d != null ? `${contactConversionPct7d}%` : '—')}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Процент пользователей, которые оставили контакт
              </p>
            </div>
            <div className="p-5 border border-border rounded-xl bg-card shadow-sm">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Новых пользователей
              </div>
              <div className="text-3xl font-semibold text-fg tabular-nums">
                {range === 'today' ? summaryToday.newUsersCount : summary7d.newUsersCount}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {range === 'today' ? 'за сегодня' : 'за 7 дней'}
              </div>
            </div>
            <div className="p-5 border border-border rounded-xl bg-card shadow-sm">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Заявок (leads)
              </div>
              <div className="text-3xl font-semibold text-fg tabular-nums">
                {leadsCount}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {range === 'today' ? 'за сегодня' : 'за 7 дней'}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Заявка — это когда человек поделился телефоном или оставил контакт.
              </p>
              {lastLeadAt ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Последний контакт:{' '}
                  {new Date(lastLeadAt)
                    .toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    .replace(', ', ' ')}
                </p>
              ) : null}
            </div>
            <div className="p-5 border border-border rounded-xl bg-card shadow-sm">
              <div className="text-sm font-medium text-muted-foreground mb-1">
                Записей (appointments)
              </div>
              <div className="text-3xl font-semibold text-fg tabular-nums">
                {appointmentsCount}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {range === 'today' ? 'за сегодня' : 'за 7 дней'}
              </div>
            </div>
          </div>

          {/* Таблица записей (стиль Google Sheets) */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-fg">
              Записи
            </h3>
            {(() => {
              type Row = { id: string; createdAt: string; type: 'lead' | 'appointment'; customerName?: string; details: string; status: string };
              const rows: Row[] = [
                ...latestAppointments.map((a: any) => ({
                  id: a.id,
                  createdAt: a.createdAt,
                  type: 'appointment' as const,
                  customerName: a.customerName ?? null,
                  details: a.startsAt ? `Запись ${new Date(a.startsAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Запись',
                  status: a.status || 'new',
                })),
                ...latestLeads.map((l: any) => ({
                  id: l.id,
                  createdAt: l.createdAt,
                  type: 'lead' as const,
                  customerName: null,
                  details: l.title || l.message || 'Заявка',
                  status: l.status || 'new',
                })),
              ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);

              if (rows.length === 0) {
                return (
                  <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
                    Нет записей. Заявки и записи появятся здесь после действий пользователей в боте.
                  </div>
                );
              }

              return (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse" style={{ minWidth: 560 }}>
                      <thead>
                        <tr className="bg-black/5 dark:bg-white/5 border-b border-border">
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-r border-border">
                            Дата и время
                          </th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-r border-border">
                            Тип
                          </th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-r border-border">
                            Клиент
                          </th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-r border-border">
                            Детали
                          </th>
                          <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                            Статус
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {rows.map((row, i) => (
                          <tr
                            key={`${row.type}-${row.id}`}
                            className={`hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${i % 2 === 1 ? 'bg-black/[0.02] dark:bg-white/[0.02]' : ''}`}
                          >
                            <td className="px-4 py-3 text-sm text-fg whitespace-nowrap border-r border-border">
                              {formatDate(row.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-fg border-r border-border">
                              {row.type === 'appointment' ? 'Запись' : 'Заявка'}
                            </td>
                            <td className="px-4 py-3 text-sm text-fg border-r border-border">
                              {row.customerName || '—'}
                            </td>
                            <td className="px-4 py-3 text-sm text-fg border-r border-border">
                              {row.details}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {getStatusLabel(row.status)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Дополнительно: заказы (если есть) */}
          {latestOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-fg">
                Последние заказы
              </h3>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <table className="w-full">
                  <thead className="bg-black/5 dark:bg-white/5">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Дата/время</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Сумма</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Статус</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {latestOrders.map((order: any) => (
                      <tr key={order.id} className="hover:bg-black/5 dark:hover:bg-white/5">
                        <td className="px-4 py-3 text-sm text-fg">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-fg">
                          {order.amount ? `${Number(order.amount).toLocaleString('ru-RU')} ${order.currency || '₽'}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{getStatusLabel(order.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

