'use client';

import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerSummary, ownerBots, ownerDeactivateBot, type ApiError } from '@/lib/api';
import { BotCard } from '@/components/bot-card';

export default function CabinetIndexPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: authData } = useOwnerAuth();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitError, setLimitError] = useState<{ activeBots: number; limit: number } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['owner-summary'],
    queryFn: ownerSummary,
    enabled: !!authData,
  });

  const { data: botsData, isLoading: botsLoading } = useQuery({
    queryKey: ['owner-bots'],
    queryFn: ownerBots,
    enabled: !!authData,
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

  useEffect(() => {
    // Only redirect if there are bots and user hasn't explicitly navigated to /cabinet
    // If user is on /cabinet page, show the bots list instead of redirecting
    if (!authData?.bots || authData.bots.length === 0) return;
    
    // Check for openBot query parameter (from mini-app deep links) - always redirect for this
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const openBotId = params.get('openBot');
      if (openBotId && authData.bots.some((b) => b.botId === openBotId)) {
        // Clean up query parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('openBot');
        window.history.replaceState({}, '', newUrl.toString());
        router.replace(`/cabinet/${openBotId}/overview`);
        return;
      }
    }

    // Check for redirect query parameter (from botlink)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const redirectPath = params.get('redirect');
      if (redirectPath && redirectPath.startsWith('/cabinet/')) {
        // Clean up query parameter
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('redirect');
        window.history.replaceState({}, '', newUrl.toString());
        router.replace(redirectPath);
        return;
      }
    }

    // Don't auto-redirect if user explicitly navigated to /cabinet
    // Show the bots list page instead
    // Only redirect if coming from login/auth flow
    const isFromAuth = typeof window !== 'undefined' && 
      (document.referrer.includes('/auth/') || document.referrer.includes('/login'));
    
    if (!isFromAuth) {
      // User explicitly navigated to /cabinet, show bots list
      return;
    }

    // Try to restore lastBotId from localStorage (only if from auth)
    let targetBotId: string | undefined;
    if (typeof window !== 'undefined') {
      const lastBotId = localStorage.getItem('owner_lastBotId');
      if (lastBotId && authData.bots.some((b) => b.botId === lastBotId)) {
        targetBotId = lastBotId;
      }
    }

    // Fallback to first available bot
    if (!targetBotId) {
      targetBotId = authData.bots[0]?.botId;
    }

    if (targetBotId) {
      router.replace(`/cabinet/${targetBotId}`);
    }
  }, [authData, botsData, router]);

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
      // Error is already shown via toast in onError
    }
  };

  if (summaryLoading || botsLoading) {
    return <div className="panel p-8">Загрузка...</div>;
  }

  // Use single source of truth: botsCountVisible from /api/owner/auth/me or total from /api/owner/bots
  const active = authData?.botsCountVisible ?? botsData?.total ?? summary?.bots.active ?? 0;
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
          onClick={() => {
            if (isLimitReached) return;
            // Navigate to bots page where user can choose template or create from scratch
            router.push('/cabinet/bots');
          }}
          disabled={isLimitReached}
          className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
        >
          Создать бота
        </button>
      </div>

      {bots.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          У вас пока нет ботов. Создайте первого бота, чтобы начать.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bots.map((bot) => (
            <BotCard key={bot.botId} botId={bot.botId} name={bot.name} />
          ))}
        </div>
      )}

      {showLimitModal && limitError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Лимит ботов достигнут</h2>
            <p className="text-muted-foreground mb-4">
              У вас уже {limitError.activeBots} активных ботов из {limitError.limit} доступных.
            </p>
            <button
              onClick={() => {
                setShowLimitModal(false);
                setLimitError(null);
              }}
              className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

