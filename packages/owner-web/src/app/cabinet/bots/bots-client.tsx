'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerBots, ownerSummary, ownerDeactivateBot, type ApiError } from '@/lib/api';

export function BotsPageClient({ wizardEnabled }: { wizardEnabled: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['owner-summary'],
    queryFn: ownerSummary,
  });

  const { data: botsData, isLoading: botsLoading } = useQuery({
    queryKey: ['owner-bots'],
    queryFn: ownerBots,
  });

  const deactivateMutation = useMutation({
    mutationFn: ownerDeactivateBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-bots'] });
      queryClient.invalidateQueries({ queryKey: ['owner-summary'] });
      queryClient.invalidateQueries({ queryKey: ['owner-me'] });
      toast.success('Бот успешно деактивирован');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при деактивации бота');
    },
  });

  const handleDeactivate = async (botId: string, botName: string) => {
    const confirmed = await new Promise<boolean>((resolve) => {
      toast(
        <div className="flex flex-col gap-3">
          <div className="font-medium">Деактивировать бота?</div>
          <div className="text-sm text-muted-foreground">
            Бот "{botName}" будет деактивирован. Это действие можно отменить позже.
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                toast.dismiss();
                resolve(true);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
            >
              Деактивировать
            </button>
            <button
              onClick={() => {
                toast.dismiss();
                resolve(false);
              }}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm"
            >
              Отмена
            </button>
          </div>
        </div>,
        {
          duration: Infinity,
          id: `deactivate-${botId}`,
        }
      );
    });

    if (!confirmed) return;

    try {
      await deactivateMutation.mutateAsync(botId);
    } catch (error) {
      console.error('Failed to deactivate bot:', error);
    }
  };

  if (summaryLoading || botsLoading) {
    return (
      <div className="panel p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  const active = summary?.bots.active ?? 0;
  const limit = summary?.user.botLimit ?? 3;
  const isLimitReached = active >= limit;
  const bots = botsData?.items ?? [];

  return (
    <div className="panel p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-2">Мои боты</h1>
        <div className="flex items-center gap-4 mb-4">
          <div className="text-sm text-muted-foreground">
            Боты: <span className="font-medium">{active}/{limit}</span>
          </div>
          {isLimitReached && (
            <div className="text-sm text-amber-600 dark:text-amber-400">
              Лимит достигнут. Удалите бота или обновите план.
            </div>
          )}
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={isLimitReached}
          className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
        >
          Создать бота
        </button>
        {!wizardEnabled && (
          <div className="text-xs text-muted-foreground mt-2">
            Wizard выключен. Для активации установите ENABLE_OWNER_WIZARD=1
          </div>
        )}
      </div>

      {bots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          У вас пока нет ботов. Создайте первого бота, чтобы начать.
        </div>
      ) : (
        <div className="space-y-2">
          {bots.map((bot) => (
            <div
              key={bot.botId}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <div>
                <div className="font-medium">{bot.name}</div>
                <div className="text-sm text-muted-foreground">ID: {bot.botId}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/cabinet/${bot.botId}/overview`)}
                  className="px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90"
                >
                  Открыть
                </button>
                <button
                  onClick={() => handleDeactivate(bot.botId, bot.name)}
                  disabled={deactivateMutation.isPending}
                  className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {deactivateMutation.isPending ? 'Деактивация...' : 'Удалить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateBotModal
          onClose={() => setShowCreateModal(false)}
          onSelectTemplate={() => {
            setShowCreateModal(false);
            if (wizardEnabled) {
              router.push('/cabinet/bots/new?template=true');
            } else {
              router.push('/cabinet/bots/templates');
            }
          }}
          onCreateFromScratch={() => {
            setShowCreateModal(false);
            router.push('/cabinet/bots/new');
          }}
          wizardEnabled={wizardEnabled}
        />
      )}
    </div>
  );
}

function CreateBotModal({
  onClose,
  onSelectTemplate,
  onCreateFromScratch,
  wizardEnabled,
}: {
  onClose: () => void;
  onSelectTemplate: () => void;
  onCreateFromScratch: () => void;
  wizardEnabled: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 p-6 rounded-lg max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold mb-4">Создать бота</h2>
        <div className="space-y-3">
          {wizardEnabled && (
            <button
              onClick={onSelectTemplate}
              className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 text-left"
            >
              <div className="font-medium">Использовать шаблон</div>
              <div className="text-sm opacity-90">Выберите из готовых шаблонов</div>
            </button>
          )}
          <button
            onClick={onCreateFromScratch}
            className="w-full px-4 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-left"
          >
            <div className="font-medium">Создать с нуля</div>
            <div className="text-sm opacity-90">Начните с пустого бота</div>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

