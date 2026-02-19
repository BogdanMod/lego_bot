'use client';

import { ownerFetch } from '@/lib/api';
import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useSSEStream } from '@/hooks/use-sse-stream';
import { usePathname, useRouter, useParams } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { BotSelector } from '@/components/bot-selector';
import { CommandPalette } from '@/components/command-palette';
import { ModeToggle } from '@/components/mode-toggle';
import { CabinetSidebar } from '@/components/cabinet-sidebar';
import { i18n } from '@/lib/i18n';

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
      <div className="min-h-screen grid grid-cols-[240px_1fr]">
        <CabinetSidebar />

        <div className="p-6">
          <header className="panel px-4 py-3 flex items-center gap-3 justify-between mb-4">
            {currentBotId && <BotSelector bots={data.bots || []} currentBotId={currentBotId} />}
            <div className="flex items-center gap-4 ml-auto">
              <ModeToggle />
              {currentBotId && (
                <input
                  id="global-search"
                  placeholder={`${i18n.common.search} (/)`}
                  className="w-[360px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
                  onChange={async (e) => {
                    const q = e.target.value.trim();
                    if (!q) return;
                    await ownerFetch(`/api/owner/bots/${currentBotId}/events?q=${encodeURIComponent(q)}&limit=20`);
                  }}
                />
              )}
            </div>
          </header>
          <div>{children}</div>
        </div>
      </div>
    </>
  );
}

