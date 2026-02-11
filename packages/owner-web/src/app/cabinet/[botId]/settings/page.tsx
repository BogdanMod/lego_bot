'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';

export default function SettingsPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить настройки" />;
  }

  const settings = data?.settings || {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{i18n.settings.title}</h1>
      <div className="panel p-6">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Название бизнеса</label>
            <div className="mt-1 text-sm text-muted-foreground">
              {settings.businessName || 'Не указано'}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Часовой пояс</label>
            <div className="mt-1 text-sm text-muted-foreground">
              {settings.timezone || 'Не указано'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

