'use client';

import { Link, useLocation } from 'react-router-dom';
import { CreditCard, Bot } from 'lucide-react';

export function BillingNavigation() {
  const location = useLocation();
  const isSubscription = location.pathname === '/subscription' || location.pathname === '/';
  const isBots = location.pathname === '/bots';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50">
      <div className="max-w-md mx-auto flex">
        <Link
          to="/subscription"
          className={`flex-1 flex flex-col items-center justify-center py-3 px-4 transition-colors ${
            isSubscription
              ? 'text-slate-900 dark:text-slate-100'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CreditCard className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">Подписка</span>
        </Link>
        <Link
          to="/bots"
          className={`flex-1 flex flex-col items-center justify-center py-3 px-4 transition-colors ${
            isBots
              ? 'text-slate-900 dark:text-slate-100'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Bot className="w-5 h-5 mb-1" />
          <span className="text-xs font-medium">Боты</span>
        </Link>
      </div>
    </nav>
  );
}

