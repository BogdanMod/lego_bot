'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { LeadsTab } from './live-mode/leads-tab';
import { CustomersTab } from './live-mode/customers-tab';
import { OrdersTab } from './live-mode/orders-tab';
import { AnalysisDashboard } from './live-mode/analysis-dashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, ShoppingCart, FileText, LayoutDashboard, Bot, ArrowRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

type LiveTab = 'overview' | 'leads' | 'customers' | 'orders';

interface LiveModeViewProps {
  botId: string;
}

export function LiveModeView({ botId }: LiveModeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LiveTab>('overview');

  // Get initial tab from URL, default to 'overview'
  useEffect(() => {
    const tab = searchParams?.get('tab') as LiveTab | null;
    if (tab && ['overview', 'leads', 'customers', 'orders'].includes(tab)) {
      setActiveTab(tab);
    } else {
      // Default to 'overview' if no tab specified
      setActiveTab('overview');
      if (!tab) {
        router.replace(`/cabinet/${botId}?mode=manage&tab=overview`);
      }
    }
  }, [searchParams, botId, router]);

  // Fetch bot data to check if it's active
  const { data: botData, isLoading: botLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  const botStatus = botData?.status || {
    isActive: false,
    webhookSet: false,
    hasToken: false,
    lastEventAt: null,
    hasRecentActivity: false,
  };
  const hasToken = !!botData?.bot?.hasToken;

  // Update URL when tab changes
  const handleTabChange = (tab: LiveTab) => {
    setActiveTab(tab);
    const newUrl = `/cabinet/${botId}?mode=manage&tab=${tab}`;
    router.replace(newUrl);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as LiveTab)} className="flex flex-col h-full">
        <div className="border-b border-slate-200 dark:border-slate-800 px-6">
          <TabsList className="bg-transparent h-12 p-0">
            <TabsTrigger
              value="overview"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <LayoutDashboard className="w-4 h-4 mr-2" />
              Обзор
            </TabsTrigger>
            <TabsTrigger
              value="leads"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <FileText className="w-4 h-4 mr-2" />
              Заявки
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Заказы
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <Users className="w-4 h-4 mr-2" />
              Клиенты
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="overview" className="h-full m-0 p-6">
            {!hasToken && (
              <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-5 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/50">
                      <Bot className="w-6 h-6 text-amber-700 dark:text-amber-300" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 mb-1">
                        Подключите бота к Telegram
                      </h2>
                      <p className="text-sm text-amber-800 dark:text-amber-200/90">
                        Без токена бот не работает. Откройте @BotFather в Telegram → /newbot → скопируйте токен и вставьте его ниже.
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/cabinet/${botId}/settings`}
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white transition-colors"
                  >
                    Вставить токен
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
            <AnalysisDashboard botId={botId} />
          </TabsContent>
          <TabsContent value="leads" className="h-full m-0 p-6">
            <LeadsTab botId={botId} />
          </TabsContent>
          <TabsContent value="orders" className="h-full m-0 p-6">
            <OrdersTab botId={botId} />
          </TabsContent>
          <TabsContent value="customers" className="h-full m-0 p-6">
            <CustomersTab botId={botId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

