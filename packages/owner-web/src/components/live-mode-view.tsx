'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { LeadsTab } from './live-mode/leads-tab';
import { CustomersTab } from './live-mode/customers-tab';
import { OrdersTab } from './live-mode/orders-tab';
import { AnalysisDashboard } from './live-mode/analysis-dashboard';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, ShoppingCart, FileText, Settings, LayoutDashboard } from 'lucide-react';
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

