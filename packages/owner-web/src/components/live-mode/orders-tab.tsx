'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';

interface OrdersTabProps {
  botId: string;
}

export function OrdersTab({ botId }: OrdersTabProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/orders?limit=100`),
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
        description="Не удалось загрузить заказы. Попробуйте обновить страницу."
      />
    );
  }

  const orders = data?.items || [];

  if (orders.length === 0) {
    return (
      <EmptyState
        title="Нет заказов"
        description="Заказы от клиентов будут отображаться здесь."
      />
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((order: any) => (
        <div
          key={order.id}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:border-primary/50 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium text-slate-900 dark:text-slate-100 mb-1">
                Заказ #{order.id?.slice(0, 8) || 'N/A'}
              </div>
              {order.customerName && (
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                  Клиент: {order.customerName}
                </div>
              )}
              {order.total && (
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-2">
                  {order.total} ₽
                </div>
              )}
              {order.createdAt && (
                <div className="text-xs text-slate-500 dark:text-slate-500 mt-2">
                  {new Date(order.createdAt).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
            {order.status && (
              <Badge variant={order.status === 'completed' ? 'success' : 'default'} className="ml-4">
                {order.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

