'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';

export default function AuditPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/audit?limit=50`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить аудит" />;
  }

  const audit = data?.items || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{i18n.audit.title}</h1>
      {audit.length === 0 ? (
        <EmptyState title={i18n.audit.empty} description={i18n.audit.emptyDesc} />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {audit.map((entry: any) => (
              <div key={entry.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="text-sm">
                  <span className="font-medium">{entry.action}</span> на {entry.entity} в{' '}
                  {new Date(entry.createdAt).toLocaleString('ru-RU')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Пользователь: {entry.actorTelegramUserId}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

