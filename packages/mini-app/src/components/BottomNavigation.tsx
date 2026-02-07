import React from 'react';
import { Home as HomeIcon, Database, ShoppingBag, Settings } from 'lucide-react';
import type { MainTab } from '../types';

export interface BottomNavigationProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  const tabs: Array<{ id: MainTab; icon: React.ReactNode }> = [
    { id: 'home', icon: <HomeIcon size={22} /> },
    { id: 'leads', icon: <Database size={22} /> },
    { id: 'store', icon: <ShoppingBag size={22} /> },
    { id: 'settings', icon: <Settings size={22} /> },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="mx-auto max-w-md px-4 pb-4">
        <div
          className={[
            'flex items-center justify-around rounded-[2rem] border px-4 py-3',
            'bg-white/80 border-slate-200 shadow-xl backdrop-blur',
            'dark:bg-slate-900/80 dark:border-slate-800',
          ].join(' ')}
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={[
                  'flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200',
                  isActive
                    ? 'text-indigo-600 dark:text-indigo-400 scale-110'
                    : 'text-slate-400 dark:text-slate-500',
                ].join(' ')}
                aria-label={tab.id}
              >
                {tab.icon}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

