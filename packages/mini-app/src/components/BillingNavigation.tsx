'use client';

import { Link, useLocation } from 'react-router-dom';

export function BillingNavigation() {
  const location = useLocation();
  const isStatus = location.pathname === '/status' || location.pathname === '/';
  const isBots = location.pathname === '/bots';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] shadow-[0 -4px 12px rgba(0,0,0,0.04)] dark:shadow-[0 -4px 12px rgba(0,0,0,0.2)]">
      <div className="max-w-md mx-auto flex">
        <Link
          to="/status"
          className={`
            flex-1 flex items-center justify-center py-3.5 px-4 text-sm font-medium transition-colors
            ${isStatus
              ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-500/15 border-b-2 border-violet-500 dark:border-violet-400'
              : 'text-[var(--text-hint)] hover:text-violet-600 dark:hover:text-violet-400'}
          `}
        >
          Статус
        </Link>
        <Link
          to="/bots"
          className={`
            flex-1 flex items-center justify-center py-3.5 px-4 text-sm font-medium transition-colors
            ${isBots
              ? 'text-violet-600 dark:text-violet-400 bg-violet-500/10 dark:bg-violet-500/15 border-b-2 border-violet-500 dark:border-violet-400'
              : 'text-[var(--text-hint)] hover:text-violet-600 dark:hover:text-violet-400'}
          `}
        >
          Боты
        </Link>
      </div>
    </nav>
  );
}
