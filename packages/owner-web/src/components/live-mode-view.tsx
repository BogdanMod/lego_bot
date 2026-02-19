'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { LeadsTab } from './live-mode/leads-tab';
import { CustomersTab } from './live-mode/customers-tab';
import { OrdersTab } from './live-mode/orders-tab';
import { AnalyticsTab } from './live-mode/analytics-tab';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users, ShoppingCart, TrendingUp, FileText } from 'lucide-react';

type LiveTab = 'leads' | 'customers' | 'orders' | 'analytics';

interface LiveModeViewProps {
  botId: string;
}

export function LiveModeView({ botId }: LiveModeViewProps) {
  const [activeTab, setActiveTab] = useState<LiveTab>('leads');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as LiveTab)} className="flex flex-col h-full">
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
              value="customers"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <Users className="w-4 h-4 mr-2" />
              Клиенты
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-4"
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              Заказы
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
          <TabsContent value="customers" className="h-full m-0 p-6">
            <CustomersTab botId={botId} />
          </TabsContent>
          <TabsContent value="orders" className="h-full m-0 p-6">
            <OrdersTab botId={botId} />
          </TabsContent>
          <TabsContent value="analytics" className="h-full m-0 p-6">
            <AnalyticsTab botId={botId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

