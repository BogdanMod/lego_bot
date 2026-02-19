'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

export default function LeadsPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['leads', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/leads?limit=50`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить лиды" />;
  }

  const leads = data?.items || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{i18n.leads.title}</h1>
      {leads.length === 0 ? (
        <EmptyState title={i18n.leads.empty} description={i18n.leads.emptyDesc} />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {leads.map((lead: any) => (
              <div key={lead.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{lead.name || 'Без имени'}</div>
                    <div className="text-sm text-muted-foreground">{lead.phone || lead.email || 'Нет контакта'}</div>
                  </div>
                  <Badge variant={lead.status === 'converted' ? 'success' : 'default'}>
                    {lead.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


