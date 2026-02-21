'use client';

import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { ownerFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function MobileClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const botIdParam = searchParams.get('botId');
  const tabParam = searchParams.get('tab') || 'leads';
  const tab = tabParam === 'appointments' ? 'appointments' : 'leads';

  const { data: authData, isLoading: authLoading, isError: authError } = useOwnerAuth();
  const bots = authData?.bots ?? [];
  const hasAccessToRequestedBot = !botIdParam || bots.some((b) => b.botId === botIdParam);
  const botId = useMemo(() => {
    if (botIdParam && bots.some((b) => b.botId === botIdParam)) return botIdParam;
    return bots[0]?.botId ?? null;
  }, [botIdParam, bots]);

  useEffect(() => {
    if (authLoading) return;
    const err = (authData as any)?.error || (authData as any);
    const code = err?.code;
    if (authError && (code === 'unauthorized' || code === 'forbidden' || code === 'csrf_failed' || code === 'csrf_token_mismatch')) {
      router.replace('/login');
    }
  }, [authLoading, authError, authData, router]);

  const { data: analytics, isLoading: dataLoading } = useQuery({
    queryKey: ['analytics-dashboard', botId, '7d'],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}/analytics?range=7d`),
    enabled: !!botId,
  });

  const latestLeads = analytics?.latestLeads ?? [];
  const latestAppointments = analytics?.latestAppointments ?? [];
  const summary7d = analytics?.summary7d ?? {};
  const leadsCount = summary7d.leadsCount ?? 0;
  const appointmentsCount = summary7d.appointmentsCount ?? 0;

  const items = useMemo(() => {
    const leadRows = latestLeads.slice(0, 20).map((l: any) => ({
      id: l.id,
      type: 'lead' as const,
      title: l.title || l.message || 'Заявка',
      createdAt: l.createdAt,
    }));
    const apptRows = latestAppointments.slice(0, 20).map((a: any) => ({
      id: a.id,
      type: 'appointment' as const,
      title: a.startsAt ? `Запись ${formatDate(a.startsAt)}` : 'Запись',
      createdAt: a.createdAt,
    }));
    const combined = [...leadRows, ...apptRows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return tab === 'leads' ? combined.filter((i) => i.type === 'lead') : combined.filter((i) => i.type === 'appointment');
  }, [tab, latestLeads, latestAppointments]);

  if (authLoading || (!authData && !authError)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-muted-foreground text-sm">Загрузка...</div>
      </div>
    );
  }

  if (authError && !bots.length) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="text-center text-sm text-muted-foreground">
          Ошибка доступа. <button type="button" onClick={() => router.push('/login')} className="text-primary underline">Войти</button>
        </div>
      </div>
    );
  }

  // Нет ботов — пустое состояние + CTA в полную версию
  if (bots.length === 0) {
    return (
      <div className="min-h-screen bg-bg text-fg">
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="text-xs font-semibold text-primary tracking-wider">Zer | Con</div>
          <div className="text-[10px] text-muted-foreground">Кабинет</div>
        </header>
        <main className="max-w-md mx-auto p-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">Нет доступных ботов.</p>
            <a href="/cabinet" className="inline-block py-2.5 px-4 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
              Создать бота
            </a>
          </div>
        </main>
      </div>
    );
  }

  // Есть botId в URL, но нет доступа к этому боту
  if (botIdParam && !hasAccessToRequestedBot) {
    return (
      <div className="min-h-screen bg-bg text-fg">
        <header className="border-b border-border bg-card px-4 py-3">
          <div className="text-xs font-semibold text-primary tracking-wider">Zer | Con</div>
          <div className="text-[10px] text-muted-foreground">Кабинет</div>
        </header>
        <main className="max-w-md mx-auto p-4">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">Нет доступа к этому боту.</p>
            <button
              type="button"
              onClick={() => router.push('/cabinet')}
              className="inline-block py-2.5 px-4 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              К списку ботов
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="text-xs font-semibold text-primary tracking-wider">Zer | Con</div>
        <div className="text-[10px] text-muted-foreground">Кабинет</div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-24">
        {!botId ? (
          <div className="text-sm text-muted-foreground py-6">Нет доступных ботов.</div>
        ) : (
          <>
            {/* Bot selector: if multiple bots, show dropdown or link to switch */}
            {bots.length > 1 && (
              <div className="mb-4">
                <label className="text-xs text-muted-foreground block mb-1">Бот</label>
                <select
                  value={botId}
                  onChange={(e) => router.push(`/m?botId=${encodeURIComponent(e.target.value)}&tab=${tab}`)}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-fg"
                >
                  {bots.map((b) => (
                    <option key={b.botId} value={b.botId}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => router.push(`/m?botId=${botId}&tab=leads`)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg ${tab === 'leads' ? 'bg-primary text-primary-foreground' : 'bg-black/5 dark:bg-white/5 text-fg'}`}
              >
                Заявки
              </button>
              <button
                type="button"
                onClick={() => router.push(`/m?botId=${botId}&tab=appointments`)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg ${tab === 'appointments' ? 'bg-primary text-primary-foreground' : 'bg-black/5 dark:bg-white/5 text-fg'}`}
              >
                Записи
              </button>
            </div>

            {/* Badge today */}
            <div className="text-xs text-muted-foreground mb-3">
              {tab === 'leads' ? `Сегодня: ${leadsCount}` : `Сегодня: ${appointmentsCount}`}
            </div>

            {/* List */}
            {dataLoading ? (
              <div className="text-sm text-muted-foreground py-4">Загрузка...</div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                {tab === 'leads' ? 'Нет заявок' : 'Нет записей'}
              </div>
            ) : (
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={`${item.type}-${item.id}`}
                    className="rounded-xl border border-border bg-card p-3 text-sm"
                  >
                    <div className="font-medium text-fg">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDate(item.createdAt)}</div>
                  </li>
                ))}
              </ul>
            )}

            {/* Full version button */}
            <div className="mt-6">
              <a
                href={typeof window !== 'undefined' ? `${window.location.origin}/cabinet/${botId}/analytics` : `/cabinet/${botId}/analytics`}
                className="block w-full py-3 text-center text-sm font-medium rounded-xl border border-border bg-card text-fg hover:bg-black/5 dark:hover:bg-white/5"
              >
                Открыть полную версию
              </a>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
