'use client';

import { Link, useLocation } from 'react-router-dom';

export function BillingNavigation() {
  const location = useLocation();
  const isStatus = location.pathname === '/status' || location.pathname === '/';
  const isBots = location.pathname === '/bots';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-50">
      <div className="max-w-md mx-auto flex">
        <Link
          to="/status"
          className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium transition-colors ${
            isStatus
              ? 'text-slate-900 dark:text-slate-100 border-b-2 border-slate-900 dark:border-slate-100'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Статус
        </Link>
        <Link
          to="/bots"
          className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium transition-colors ${
            isBots
              ? 'text-slate-900 dark:text-slate-100 border-b-2 border-slate-900 dark:border-slate-100'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Боты
        </Link>
      </div>
    </nav>
  );
}
