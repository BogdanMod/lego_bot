'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';

export default function CalendarPage() {
  const params = useParams();
  const botId = params.botId as string;
  const from = new Date().toISOString();
  const to = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, isLoading, error } = useQuery({
    queryKey: ['appointments', botId, from, to],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/appointments?from=${from}&to=${to}`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить календарь" />;
  }

  const appointments = (data?.items || []).slice(0, 20);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{i18n.calendar.title}</h1>
      {appointments.length === 0 ? (
        <EmptyState title={i18n.calendar.empty} description={i18n.calendar.emptyDesc} />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {appointments.map((apt: any) => (
              <div key={apt.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="font-medium">{new Date(apt.startsAt).toLocaleString('ru-RU')}</div>
                <div className="text-sm text-muted-foreground">{apt.customerName || 'Без имени'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


