'use client';

import { ownerFetch, ownerLogout } from '@/lib/api';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BotSelector } from '@/components/bot-selector';
import { CommandPalette } from '@/components/command-palette';
import { i18n } from '@/lib/i18n';

const sections = [
  { key: 'overview', label: i18n.nav.overview },
  { key: 'inbox', label: i18n.nav.inbox },
  { key: 'calendar', label: i18n.nav.calendar },
  { key: 'orders', label: i18n.nav.orders },
  { key: 'leads', label: i18n.nav.leads },
  { key: 'customers', label: i18n.nav.customers },
  { key: 'team', label: i18n.nav.team },
  { key: 'settings', label: i18n.nav.settings },
  { key: 'audit', label: i18n.nav.audit },
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

export function CabinetLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { data, isLoading, isError } = useOwnerAuth();

  const currentBotId = params?.botId as string | undefined;
  const activeBot = data?.bots?.find((b) => b.botId === currentBotId) || data?.bots?.[0];
  
  useHotkeys(currentBotId);

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      router.replace('/login');
    }
  }, [isError, isLoading, data, router]);

  if (isLoading || !data) {
    return <div className="min-h-screen p-8">{i18n.common.loading}</div>;
  }

  return (
    <>
      <CommandPalette botId={currentBotId} />
      <div className="min-h-screen grid grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-card p-5">
        <div className="text-xl font-semibold">Owner Cabinet</div>
        <div className="mt-1 text-sm text-muted-foreground">{data.user.firstName || 'Пользователь'}</div>

        <div className="mt-6 text-xs uppercase tracking-wide text-muted-foreground">Разделы</div>
        <nav className="mt-2 space-y-1">
          {sections.map((section) => {
            const href = currentBotId ? `/cabinet/${currentBotId}/${section.key}` : '/cabinet';
            const active = pathname.startsWith(href);
            return (
              <button
                key={section.key}
                onClick={() => router.push(href)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground'
                }`}
              >
                {section.label}
              </button>
            );
          })}
        </nav>

        <button
          className="mt-8 w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          onClick={async () => {
            await ownerLogout();
            router.replace('/login');
          }}
        >
          Выйти
        </button>
      </aside>

      <div className="p-6">
        <header className="panel px-4 py-3 flex items-center gap-3 justify-between mb-4">
          <BotSelector bots={data.bots || []} currentBotId={currentBotId} />
          <input
            id="global-search"
            placeholder={`${i18n.common.search} (/)`}
            className="w-[360px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            onChange={async (e) => {
              if (!currentBotId) return;
              const q = e.target.value.trim();
              if (!q) return;
              await ownerFetch(`/api/owner/bots/${currentBotId}/events?q=${encodeURIComponent(q)}&limit=20`);
            }}
          />
        </header>
        <div>{children}</div>
      </div>
      </div>
    </>
  );
}

