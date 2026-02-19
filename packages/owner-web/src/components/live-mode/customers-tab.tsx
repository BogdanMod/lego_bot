'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

interface CustomersTabProps {
  botId: string;
}

export function CustomersTab({ botId }: CustomersTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/customers?limit=100`),
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
        description="Не удалось загрузить клиентов. Попробуйте обновить страницу."
      />
    );
  }

  const customers = data?.items || [];

  if (customers.length === 0) {
    return (
      <EmptyState
        title="Нет клиентов"
        description="Клиенты, взаимодействовавшие с ботом, будут отображаться здесь."
      />
    );
  }

  return (
    <div className="space-y-3">
      {customers.map((customer: any) => (
        <div
          key={customer.id}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="font-medium text-slate-900 dark:text-slate-100 mb-2">
            {customer.name || 'Без имени'}
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
            {customer.phone && <div>📞 {customer.phone}</div>}
            {customer.email && <div>✉️ {customer.email}</div>}
          </div>
          {customer.firstInteractionAt && (
            <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
              Первое взаимодействие: {new Date(customer.firstInteractionAt).toLocaleString('ru-RU')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

