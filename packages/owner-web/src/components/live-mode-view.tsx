'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { LeadsTab } from './live-mode/leads-tab';
import { CustomersTab } from './live-mode/customers-tab';
import { OrdersTab } from './live-mode/orders-tab';
import { AnalyticsTab } from './live-mode/analytics-tab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, ShoppingCart, TrendingUp, FileText, Settings } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

type LiveTab = 'leads' | 'customers' | 'orders' | 'analytics';

interface LiveModeViewProps {
  botId: string;
}

export function LiveModeView({ botId }: LiveModeViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<LiveTab>('leads');

  // Get initial tab from URL
  useEffect(() => {
    const tab = searchParams?.get('tab') as LiveTab | null;
    if (tab && ['leads', 'customers', 'orders', 'analytics'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Fetch bot data to check if it's active
  const { data: botData, isLoading: botLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  const isBotActive = botData?.hasToken || false;

  // Update URL when tab changes
  const handleTabChange = (tab: LiveTab) => {
    setActiveTab(tab);
    const newUrl = `/cabinet/${botId}?mode=manage&tab=${tab}`;
    router.replace(newUrl);
  };

  // Show "Bot not active" message if bot is not published
  if (!botLoading && !isBotActive) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <EmptyState
          title="Бот не запущен"
          description="Запустите бота, чтобы получать заявки и работать с клиентами."
          icon={<Settings className="w-16 h-16 text-slate-400 dark:text-slate-600" />}
          action={{
            label: 'Перейти к настройке',
            onClick: () => router.push(`/cabinet/${botId}/settings?mode=edit`),
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <Tabs value={activeTab} onValueChange={(v) => handleTabChange(v as LiveTab)} className="flex flex-col h-full">
        <div className="border-b border-slate-200 dark:border-slate-800 px-6">
          <TabsList className="bg-transparent h-12 p-0">
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
            <TabsTrigger
              value="analytics"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Аналитика
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          <TabsContent value="leads" className="h-full m-0 p-6">
            <LeadsTab botId={botId} />
          </TabsContent>
          <TabsContent value="orders" className="h-full m-0 p-6">
            <OrdersTab botId={botId} />
          </TabsContent>
          <TabsContent value="customers" className="h-full m-0 p-6">
            <CustomersTab botId={botId} />
          </TabsContent>
          <TabsContent value="analytics" className="h-full m-0 p-6">
            <AnalyticsTab botId={botId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

