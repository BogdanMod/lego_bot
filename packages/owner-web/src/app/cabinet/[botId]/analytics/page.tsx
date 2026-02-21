'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { AnalysisDashboard } from '@/components/live-mode/analysis-dashboard';
import { Bot, ArrowRight } from 'lucide-react';

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
      <div className="h-full p-6 flex items-center justify-center">
        <div className="w-full max-w-xl rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-8">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="p-4 rounded-2xl bg-amber-100 dark:bg-amber-900/50">
              <Bot className="w-12 h-12 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-amber-900 dark:text-amber-100 mb-2">
                Сначала подключите бота к Telegram
              </h1>
              <p className="text-sm text-amber-800 dark:text-amber-200/90">
                Аналитика доступна после подключения токена. Откройте @BotFather → /newbot → скопируйте токен и вставьте в настройках.
              </p>
            </div>
            <Link
              href={`/cabinet/${botId}/settings`}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white transition-colors"
            >
              Перейти к подключению токена
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
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
