'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerFetch } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { i18n } from '@/lib/i18n';
import { BotPublish } from '@/components/bot-publish';

export default function SettingsPage() {
  const params = useParams();
  const botId = params.botId as string;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
  });

  const patchSettingsMutation = useMutation({
    mutationFn: async (patch: { bookingMode?: 'none' | 'slots' }) => {
      return ownerFetch<any>(`/api/owner/bots/${botId}/settings`, {
        method: 'PATCH',
        body: patch,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['bot', botId], (prev: any) => (prev ? { ...prev, settings: updated } : prev));
      toast.success('Настройки сохранены');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Не удалось сохранить настройки');
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (error) {
    return <EmptyState title={i18n.errors.serverError} description="Не удалось загрузить настройки" />;
  }

  const settings = data?.settings || {};
  const hasToken = !!data?.bot?.hasToken;
  const bookingMode = (settings.bookingMode as string) ?? 'none';
  const slotsEnabled = bookingMode === 'slots';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{i18n.settings.title}</h1>
      
      {/* Bot Publishing Section */}
      <BotPublish 
        botId={botId} 
        botName={data?.name || 'Бот'} 
        hasToken={hasToken}
      />

      {/* Booking mode: slots vs none */}
      <div className="panel p-6">
        <h2 className="text-lg font-semibold mb-4">Тип работы с клиентами</h2>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={slotsEnabled}
            disabled={patchSettingsMutation.isPending}
            onChange={(e) => {
              patchSettingsMutation.mutate({ bookingMode: e.target.checked ? 'slots' : 'none' });
            }}
            className="mt-1 rounded border-border"
          />
          <span className="text-sm font-medium">У меня есть запись по времени (слоты)</span>
        </label>
        <p className="mt-2 text-sm text-muted-foreground">
          Включите, если клиенты записываются на конкретное время (например, салон, барбершоп, клиника).
          Если вы принимаете заказы без времени (магазин, кафе, цветы) — оставьте выключенным.
        </p>
      </div>

      {/* Other Settings */}
      <div className="panel p-6">
        <h2 className="text-lg font-semibold mb-4">Общие настройки</h2>
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


