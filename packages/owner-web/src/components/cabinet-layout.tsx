'use client';

import { ownerFetch, ownerLogout } from '@/lib/api';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const sections = [
  { key: 'overview', label: 'Overview' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'orders', label: 'Orders' },
  { key: 'leads', label: 'Leads' },
  { key: 'customers', label: 'Customers' },
  { key: 'team', label: 'Team' },
  { key: 'settings', label: 'Settings' },
  { key: 'audit', label: 'Audit' },
];

function useHotkeys(botId?: string) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === '/' && (event.target as HTMLElement)?.tagName !== 'INPUT') {
        event.preventDefault();
        const el = document.getElementById('global-search') as HTMLInputElement | null;
        el?.focus();
      }
      if (event.key.toLowerCase() === 'g' && botId) {
        const next = (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === 'i') router.push(`/cabinet/${botId}/inbox`);
          if (e.key.toLowerCase() === 'c') router.push(`/cabinet/${botId}/calendar`);
          document.removeEventListener('keydown', next);
        };
        document.addEventListener('keydown', next);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [botId, router]);
}

export function CabinetLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError } = useOwnerAuth();

  const activeBot = data?.bots?.[0];
  useHotkeys(activeBot?.botId);

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      router.replace('/login');
    }
  }, [isError, isLoading, data, router]);

  if (isLoading || !data) {
    return <div className="min-h-screen p-8">Загрузка кабинета...</div>;
  }

  const currentBotId = activeBot?.botId;

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-card p-5">
        <div className="text-xl font-semibold">Owner Cabinet</div>
        <div className="mt-1 text-sm muted">{data.user.firstName || 'Пользователь'}</div>

        <div className="mt-6 text-xs uppercase tracking-wide muted">Разделы</div>
        <nav className="mt-2 space-y-1">
          {sections.map((section) => {
            const href = currentBotId ? `/cabinet/${currentBotId}/${section.key}` : '/cabinet';
            const active = pathname.startsWith(href);
            return (
              <button
                key={section.key}
                onClick={() => router.push(href)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${
                  active ? 'bg-primary text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </nav>

        <button
          className="mt-8 w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          onClick={async () => {
            await ownerLogout();
            router.replace('/login');
          }}
        >
          Выйти
        </button>
      </aside>

      <div className="p-6">
        <header className="panel px-4 py-3 flex items-center gap-3 justify-between">
          <div className="font-medium">{activeBot?.name || 'Bot'}</div>
          <input
            id="global-search"
            placeholder="Глобальный поиск (/)"
            className="w-[360px] rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            onChange={async (e) => {
              if (!currentBotId) return;
              const q = e.target.value.trim();
              if (!q) return;
              await ownerFetch(`/api/owner/bots/${currentBotId}/events?q=${encodeURIComponent(q)}&limit=20`);
            }}
          />
        </header>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

