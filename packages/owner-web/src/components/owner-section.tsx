'use client';

import { ownerFetch } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

function SectionTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-lg font-medium">Пока пусто</div>
        <div className="muted text-sm mt-1">Как только появятся события, они будут отображаться здесь.</div>
      </div>
    );
  }
  const headers = Object.keys(rows[0]).slice(0, 8);
  return (
    <div className="panel overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-border/60 hover:bg-slate-50 dark:hover:bg-slate-900/40">
              {headers.map((h) => (
                <td key={h} className="px-3 py-2 align-top">
                  {typeof row[h] === 'object' ? JSON.stringify(row[h]) : String(row[h] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OwnerSection({ botId, section }: { botId: string; section: string }) {
  const endpoint =
    section === 'overview'
      ? `/api/owner/bots/${botId}/events/summary`
      : section === 'inbox'
        ? `/api/owner/bots/${botId}/events?limit=100`
        : section === 'calendar'
          ? `/api/owner/bots/${botId}/appointments`
          : section === 'orders'
            ? `/api/owner/bots/${botId}/orders?limit=100`
            : section === 'leads'
              ? `/api/owner/bots/${botId}/leads?limit=100`
              : section === 'customers'
                ? `/api/owner/bots/${botId}/customers?limit=100`
                : section === 'team'
                  ? `/api/owner/bots/${botId}/team`
                  : section === 'settings'
                    ? `/api/owner/bots/${botId}`
                    : `/api/owner/bots/${botId}/audit?limit=100`;

  const { data, isLoading, error } = useQuery({
    queryKey: ['owner-section', botId, section],
    queryFn: () => ownerFetch<any>(endpoint),
  });

  if (isLoading) {
    return <div className="panel p-8">Загрузка данных...</div>;
  }

  if (error) {
    const err = error as any;
    return (
      <div className="panel p-8">
        <div className="text-red-500 font-medium">Ошибка загрузки</div>
        <div className="text-sm muted mt-1">{err?.message || 'Неизвестная ошибка'}</div>
        <div className="text-xs muted mt-1">request_id: {err?.request_id || 'n/a'}</div>
      </div>
    );
  }

  if (section === 'overview') {
    const byType = Object.entries((data?.byType || {}) as Record<string, number>).map(([name, value]) => ({ name, value }));
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="panel p-4">
            <div className="text-sm muted">Всего событий</div>
            <div className="text-3xl font-semibold mt-1">{data?.total || 0}</div>
          </div>
          {Object.entries((data?.byStatus || {}) as Record<string, number>).map(([key, value]) => (
            <div className="panel p-4" key={key}>
              <div className="text-sm muted">Статус: {key}</div>
              <div className="text-3xl font-semibold mt-1">{value}</div>
            </div>
          ))}
        </div>
        <div className="panel p-4">
          <div className="font-medium mb-3">События по типам</div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byType}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : data ? [data] : [];
  return <SectionTable rows={rows as Array<Record<string, unknown>>} />;
}

