'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

export default function TeamPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['team', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/team`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить команду" />;
  }

  const team = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{i18n.team.title}</h1>
      </div>
      {team.length === 0 ? (
        <EmptyState title={i18n.team.empty} description={i18n.team.emptyDesc} />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {team.map((member: any) => (
              <div key={member.telegramUserId} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">ID: {member.telegramUserId}</div>
                    <div className="text-sm text-muted-foreground">
                      Добавлен: {new Date(member.createdAt).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <Badge variant={member.role === 'owner' ? 'success' : 'default'}>
                    {i18n.roles[member.role as keyof typeof i18n.roles] || member.role}
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

