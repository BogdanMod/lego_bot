'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { AnalysisDashboard } from '@/components/live-mode/analysis-dashboard';
import { BotPublish } from '@/components/bot-publish';

export default function AnalyticsPage() {
  const params = useParams();
  const botId = params.botId as string;

  const { data: botData } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  const hasToken = !!botData?.bot?.hasToken;

  if (!hasToken) {
    return (
      <div className="h-full p-6 overflow-auto">
        <div className="max-w-xl mx-auto">
          <div className="mb-4">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Аналитика
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Сначала подключите бота — вставьте токен ниже
            </p>
          </div>
          <BotPublish
            botId={botId}
            botName={botData?.name || 'Бот'}
            hasToken={false}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-6">
      <AnalysisDashboard botId={botId} />
    </div>
  );
}
