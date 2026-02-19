'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';

interface LeadsTabProps {
  botId: string;
}

export function LeadsTab({ botId }: LeadsTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leads', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/leads?limit=100`),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Ошибка загрузки"
        description="Не удалось загрузить заявки. Попробуйте обновить страницу."
      />
    );
  }

  const leads = data?.items || [];

  if (leads.length === 0) {
    return (
      <EmptyState
        title="Нет заявок"
        description="Заявки от пользователей бота будут отображаться здесь."
      />
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead: any) => (
        <div
          key={lead.id}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                {lead.name || 'Без имени'}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                {lead.phone && <div>📞 {lead.phone}</div>}
                {lead.email && <div>✉️ {lead.email}</div>}
                {lead.message && <div className="mt-2">{lead.message}</div>}
              </div>
              {lead.createdAt && (
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {new Date(lead.createdAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
            <Badge variant={lead.status === 'converted' ? 'success' : 'default'} className="ml-4">
              {lead.status || 'new'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

