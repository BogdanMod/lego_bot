'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';

export default function CustomersPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['customers', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/customers?limit=50`),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить клиентов" />;
  }

  const customers = data?.items || [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{i18n.customers.title}</h1>
      {customers.length === 0 ? (
        <EmptyState title={i18n.customers.empty} description={i18n.customers.emptyDesc} />
      ) : (
        <div className="panel">
          <div className="divide-y divide-border">
            {customers.map((customer: any) => (
              <div key={customer.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="font-medium">{customer.name || 'Без имени'}</div>
                <div className="text-sm text-muted-foreground">
                  {customer.phone && <span>📞 {customer.phone}</span>}
                  {customer.email && <span className="ml-4">✉️ {customer.email}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

