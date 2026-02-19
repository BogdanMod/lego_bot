'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

export default function InboxPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [status, setStatus] = useState<string>('new');

  const { data, isLoading, error } = useQuery({
    queryKey: ['inbox', botId, status],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/events?status=${status}&limit=50`),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title={i18n.errors.serverError}
        description="Не удалось загрузить входящие"
      />
    );
  }

  const events = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{i18n.inbox.title}</h1>
        <div className="flex gap-2">
          {['new', 'in_progress', 'done', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1 rounded text-sm ${
                status === s
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {i18n.inbox[s as keyof typeof i18n.inbox] || s}
            </button>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title={i18n.inbox.empty}
          description={i18n.inbox.emptyDesc}
        />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {events.map((event: any) => (
              <div key={event.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={event.status === 'new' ? 'info' : event.status === 'done' ? 'success' : 'default'}>
                        {event.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{event.type}</span>
                    </div>
                    <div className="text-sm">{event.payload?.text || JSON.stringify(event.payload)}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(event.createdAt).toLocaleString('ru-RU')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


