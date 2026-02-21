'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { Bot, ExternalLink, ArrowRight } from 'lucide-react';

export default function OverviewPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboard', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/dashboard`),
  });

  const { data: botData } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  const hasToken = !!botData?.bot?.hasToken;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={i18n.errors.serverError}
        description="Не удалось загрузить данные обзора"
      />
    );
  }

  const kpi = dashboardData?.kpi || {};
  const recent = dashboardData?.recent || {};

  return (
    <div className="space-y-6">
      {!hasToken && (
        <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                <Bot className="w-6 h-6 text-amber-700 dark:text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
                  Подключите бота к Telegram
                </h2>
                <p className="text-sm text-amber-800 dark:text-amber-200/90 mb-2">
                  Чтобы бот работал в Telegram, вставьте токен из BotFather в один шаг.
                </p>
                <ol className="text-xs text-amber-700 dark:text-amber-300/90 space-y-0.5">
                  <li>1. Откройте <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">@BotFather <ExternalLink className="w-3 h-3" /></a></li>
                  <li>2. Отправьте <code className="px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/50">/newbot</code> и создайте бота</li>
                  <li>3. Скопируйте токен и вставьте его в Настройках</li>
                </ol>
              </div>
            </div>
            <Link
              href={`/cabinet/${botId}/settings`}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white transition-colors"
            >
              Вставить токен
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold mb-4">{i18n.dashboard.title}</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="panel p-4">
            <div className="text-sm text-muted-foreground mb-1">{i18n.dashboard.kpi.newLeads}</div>
            <div className="text-2xl font-bold">{kpi.newLeads7d || 0}</div>
          </div>
          <div className="panel p-4">
            <div className="text-sm text-muted-foreground mb-1">{i18n.dashboard.kpi.orders}</div>
            <div className="text-2xl font-bold">{kpi.orders7d || 0}</div>
          </div>
          <div className="panel p-4">
            <div className="text-sm text-muted-foreground mb-1">{i18n.dashboard.kpi.revenue}</div>
            <div className="text-2xl font-bold">{kpi.revenue30d || 0} ₽</div>
          </div>
          <div className="panel p-4">
            <div className="text-sm text-muted-foreground mb-1">{i18n.dashboard.kpi.conversion}</div>
            <div className="text-2xl font-bold">{kpi.conversion || 0}%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Недавние лиды</h2>
          {recent.leads?.length > 0 ? (
            <div className="space-y-2">
              {recent.leads.map((lead: any) => (
                <div key={lead.id} className="text-sm">
                  <div className="font-medium">{lead.name || 'Без имени'}</div>
                  <div className="text-muted-foreground">{lead.phone || lead.email || 'Нет контакта'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Нет лидов</div>
          )}
        </div>

        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Недавние заказы</h2>
          {recent.orders?.length > 0 ? (
            <div className="space-y-2">
              {recent.orders.map((order: any) => (
                <div key={order.id} className="text-sm">
                  <div className="font-medium">Заказ #{order.id.slice(0, 8)}</div>
                  <div className="text-muted-foreground">
                    <Badge variant={order.status === 'completed' ? 'success' : 'default'}>
                      {order.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Нет заказов</div>
          )}
        </div>

        <div className="panel p-4">
          <h2 className="font-semibold mb-3">Ближайшие записи</h2>
          {recent.appointments?.length > 0 ? (
            <div className="space-y-2">
              {recent.appointments.map((apt: any) => (
                <div key={apt.id} className="text-sm">
                  <div className="font-medium">{new Date(apt.startsAt).toLocaleString('ru-RU')}</div>
                  <div className="text-muted-foreground">{apt.customerName || 'Без имени'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Нет записей</div>
          )}
        </div>
      </div>
    </div>
  );
}


