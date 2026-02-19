'use client';

import { ownerFetch, ownerLogout } from '@/lib/api';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useSSEStream } from '@/hooks/use-sse-stream';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BotSelector } from '@/components/bot-selector';
import { CommandPalette } from '@/components/command-palette';
import { ModeToggle } from '@/components/mode-toggle';
import { i18n } from '@/lib/i18n';

const sections = [
  { key: 'overview', label: i18n.nav.overview },
  { key: 'constructor', label: 'Конструктор', icon: '⚙️' },
  { key: 'inbox', label: i18n.nav.inbox },
  { key: 'calendar', label: i18n.nav.calendar },
  { key: 'orders', label: i18n.nav.orders },
  { key: 'leads', label: i18n.nav.leads },
  { key: 'customers', label: i18n.nav.customers },
  { key: 'team', label: i18n.nav.team },
  { key: 'settings', label: i18n.nav.settings },
  { key: 'audit', label: i18n.nav.audit },
];

// Special section for bots list (not bot-specific, appears first)
const BOTS_SECTION = { key: 'bots', label: i18n.nav.bots, icon: '🤖' };

// Special section for bots list (not bot-specific)
const BOTS_SECTION_KEY = 'bots';

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
  useSSEStream(currentBotId); // v2: SSE realtime updates

  useEffect(() => {
    if (!isLoading && (isError || !data)) {
      // Log error details for debugging
      if (isError) {
        const error = (data as any)?.error || (data as any);
        console.error('[OwnerAuth] Auth check failed:', {
          code: error?.code,
          message: error?.message,
          request_id: error?.request_id,
        });
      }
      router.replace('/login');
    }
  }, [isError, isLoading, data, router]);

  if (isLoading || !data) {
    // Show error message if auth failed with specific reason
    if (isError && !isLoading) {
      const error = (data as any)?.error || (data as any);
      const errorMessage = error?.message || 'Ошибка авторизации';
      return (
        <div className="min-h-screen p-8">
          <div className="panel p-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold text-red-500 mb-2">Ошибка авторизации</h2>
            <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
            {error?.code === 'misconfigured' || error?.code === 'proxy_misconfigured' ? (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm font-medium mb-2">Проверьте настройки:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  {errorMessage.includes('CORE_API_ORIGIN') && (
                    <li>В сервисе <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">owner-web</code> должна быть переменная <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">CORE_API_ORIGIN</code></li>
                  )}
                  {errorMessage.includes('JWT_SECRET') && (
                    <li>В сервисе <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">core</code> должна быть переменная <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">JWT_SECRET</code></li>
                  )}
                  {errorMessage.includes('TELEGRAM_BOT_TOKEN') && (
                    <li>В сервисе <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">core</code> должна быть переменная <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">TELEGRAM_BOT_TOKEN</code></li>
                  )}
                </ul>
                <p className="text-xs mt-3 text-muted-foreground">
                  <a href="/api/_debug/env" target="_blank" className="text-blue-500 hover:underline">
                    Проверить env переменные (dev only)
                  </a>
                </p>
              </div>
            ) : null}
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Вернуться к входу
            </button>
          </div>
        </div>
      );
    }
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
          {/* Bots section - appears first, not bot-specific */}
          <button
            onClick={() => router.push('/cabinet/bots')}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith('/cabinet/bots') && !pathname.match(/\/cabinet\/bots\/[^/]+\//)
                ? 'bg-primary text-white'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground'
            }`}
          >
            {BOTS_SECTION.icon} {BOTS_SECTION.label}
          </button>
          {/* Bot-specific sections */}
          {sections.map((section) => {
            const href = currentBotId ? `/cabinet/${currentBotId}/${section.key}` : '/cabinet';
            const active = pathname.startsWith(href);
            const icon = (section as any).icon;
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
                {icon && <span className="mr-2">{icon}</span>}
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
          <div className="flex items-center gap-4">
            <ModeToggle />
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
          </div>
        </header>
        <div>{children}</div>
      </div>
      </div>
    </>
  );
}

