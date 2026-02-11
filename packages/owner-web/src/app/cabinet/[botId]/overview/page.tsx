'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

export default function OverviewPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/dashboard`),
  });

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

  const kpi = data?.kpi || {};
  const recent = data?.recent || {};

  return (
    <div className="space-y-6">
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

