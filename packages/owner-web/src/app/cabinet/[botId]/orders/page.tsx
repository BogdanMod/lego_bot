'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

export default function OrdersPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/orders?limit=50`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить заказы" />;
  }

  const orders = data?.items || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{i18n.orders.title}</h1>
      {orders.length === 0 ? (
        <EmptyState title={i18n.orders.empty} description={i18n.orders.emptyDesc} />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {orders.map((order: any) => (
              <div key={order.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Заказ #{order.id.slice(0, 8)}</div>
                    <div className="text-sm text-muted-foreground">{order.customerName || 'Без имени'}</div>
                  </div>
                  <Badge variant={order.status === 'completed' ? 'success' : 'default'}>
                    {order.status}
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


