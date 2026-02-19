'use client';

import { useRouter, usePathname, useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch, ownerLogout } from '@/lib/api';
import { useWorkMode } from '@/contexts/mode-context';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { ArrowRight, Settings, Users, Calendar, BarChart2, FileText, ShoppingCart, Wrench, Play } from 'lucide-react';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export function CabinetSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { mode } = useWorkMode();
  const { data: authData } = useOwnerAuth();
  
  const currentBotId = params?.botId as string | undefined;
  
  // Fetch bot data to check if it's active
  const { data: botData } = useQuery({
    queryKey: ['bot', currentBotId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${currentBotId}`),
    enabled: !!currentBotId,
  });

  const isBotActive = botData?.hasToken || false;

  // Navigation items based on mode
  const getNavItems = (): NavItem[] => {
    if (!currentBotId) {
      // No bot selected - show minimal menu
      return [];
    }

    if (mode === 'manage') {
      // Work mode - operational sections
      return [
        { key: 'leads', label: 'Заявки', href: `/cabinet/${currentBotId}?mode=manage`, icon: <FileText className="w-4 h-4" /> },
        { key: 'orders', label: 'Заказы', href: `/cabinet/${currentBotId}?mode=manage&tab=orders`, icon: <ShoppingCart className="w-4 h-4" /> },
        { key: 'customers', label: 'Клиенты', href: `/cabinet/${currentBotId}?mode=manage&tab=customers`, icon: <Users className="w-4 h-4" /> },
        { key: 'calendar', label: 'Календарь', href: `/cabinet/${currentBotId}/calendar?mode=manage`, icon: <Calendar className="w-4 h-4" /> },
        { key: 'analytics', label: 'Аналитика', href: `/cabinet/${currentBotId}?mode=manage&tab=analytics`, icon: <BarChart2 className="w-4 h-4" /> },
      ];
    } else {
      // Edit mode - configuration sections
      return [
        { key: 'constructor', label: 'Конструктор', href: `/cabinet/${currentBotId}/constructor?mode=edit`, icon: <Wrench className="w-4 h-4" /> },
        // { key: 'testing', label: 'Тестирование', href: `/cabinet/${currentBotId}/testing?mode=edit` }, // TODO: Implement when ready
      ];
    }
  };

  const navItems = getNavItems();

  const isActive = (href: string): boolean => {
    const hrefPath = href.split('?')[0];
    const hrefParams = new URLSearchParams(href.split('?')[1] || '');
    
    if (mode === 'manage') {
      // For manage mode, check if we're on the bot page
      if (pathname === `/cabinet/${currentBotId}`) {
        // Check if tab matches
        if (href.includes('tab=')) {
          const tab = hrefParams.get('tab');
          const currentParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
          const currentTab = currentParams.get('tab');
          // Default to 'leads' if no tab specified
          return tab === (currentTab || 'leads');
        }
        // Default leads tab (no tab param means leads)
        return !href.includes('tab=') && !href.includes('calendar');
      }
      // For calendar, check exact path match
      if (hrefPath.includes('/calendar')) {
        return pathname === hrefPath;
      }
      return false;
    } else {
      // Edit mode - exact path match
      return pathname === hrefPath;
    }
  };

  const handleLogout = async () => {
    await ownerLogout();
    router.replace('/login');
  };

  return (
    <aside className="border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-screen">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Owner Web</div>
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {authData?.user?.firstName || 'Пользователь'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {currentBotId && (
          <>
            {/* Mode section header */}
            <div className="mb-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide px-2">
                {mode === 'manage' ? 'Работа' : 'Настройка'}
              </div>
            </div>

            {/* Navigation items */}
            <div className="space-y-0.5">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <button
                    key={item.key}
                    onClick={() => router.push(item.href)}
                    className={`w-full relative flex items-center gap-2.5 px-2 py-2 text-sm transition-colors rounded-md ${
                      active
                        ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-900 dark:bg-slate-100 rounded-r" />
                    )}
                    {item.icon && (
                      <span className={active ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}>
                        {item.icon}
                      </span>
                    )}
                    <span className="flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Divider */}
            <div className="my-3 border-t border-slate-200 dark:border-slate-800" />

            {/* Bot section */}
            <div className="mb-3">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide px-2">
                Бот
              </div>
            </div>

            <div className="space-y-0.5">
              <button
                onClick={() => router.push(`/cabinet/${currentBotId}/settings?mode=${mode}`)}
                className={`w-full relative flex items-center gap-2.5 px-2 py-2 text-sm transition-colors rounded-md ${
                  pathname.includes('/settings')
                    ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {pathname.includes('/settings') && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-900 dark:bg-slate-100 rounded-r" />
                )}
                <Settings className={`w-4 h-4 ${pathname.includes('/settings') ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`} />
                <span className="flex-1 text-left">Настройки</span>
              </button>

              {mode === 'edit' && (
                <button
                  onClick={() => {
                    router.push(`/cabinet/${currentBotId}?mode=manage`);
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-md"
                >
                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <span className="flex-1 text-left">Перейти к заявкам</span>
                </button>
              )}

              {mode === 'manage' && (
                <button
                  onClick={() => router.push(`/cabinet/${currentBotId}/team?mode=manage`)}
                  className={`w-full relative flex items-center gap-2.5 px-2 py-2 text-sm transition-colors rounded-md ${
                    pathname.includes('/team')
                      ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {pathname.includes('/team') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-900 dark:bg-slate-100 rounded-r" />
                  )}
                  <Users className={`w-4 h-4 ${pathname.includes('/team') ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span className="flex-1 text-left">Команда</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Bots list - always visible */}
        <div className="mt-6">
          <button
            onClick={() => router.push(`/cabinet/bots?mode=${mode}`)}
            className={`w-full relative flex items-center gap-2.5 px-2 py-2 text-sm transition-colors rounded-md ${
              pathname.startsWith('/cabinet/bots') && !currentBotId
                ? 'text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
          >
            {pathname.startsWith('/cabinet/bots') && !currentBotId && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-slate-900 dark:bg-slate-100 rounded-r" />
            )}
            <span className="flex-1 text-left">Мои боты</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        {/* Subscription placeholder - TODO: Implement when ready */}
        {/* <button className="w-full text-left px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
          Подписка
        </button> */}
        <button
          onClick={handleLogout}
          className="w-full text-left px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Выход
        </button>
      </div>
    </aside>
  );
}

