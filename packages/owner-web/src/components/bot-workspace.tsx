'use client';

import { useState, useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ownerFetch } from '@/lib/api';
import { BotModeToggle } from './bot-mode-toggle';
import { LiveModeView } from './live-mode-view';
import { EditModeView } from './edit-mode-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Circle } from 'lucide-react';

type BotMode = 'live' | 'edit';

export function BotWorkspace() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const botId = params.botId as string;

  // Determine mode from URL or default to 'live'
  const [mode, setMode] = useState<BotMode>(() => {
    if (pathname?.includes('/constructor')) return 'edit';
    return 'live';
  });

  // Fetch bot data
  const { data: botData, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
  });

  // Update mode when pathname changes
  useEffect(() => {
    if (pathname?.includes('/constructor')) {
      setMode('edit');
    } else {
      setMode('live');
    }
  }, [pathname]);

  const handleModeChange = (newMode: BotMode) => {
    setMode(newMode);
    if (newMode === 'edit') {
      router.push(`/cabinet/${botId}/constructor`);
    } else {
      router.push(`/cabinet/${botId}`);
    }
  };

  if (isLoading || !botData) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const botName = botData.name || 'Бот';
  const isPublished = botData.bot?.hasToken || false;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Top Bar */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{botName}</h1>
          <div className="flex items-center gap-1.5">
            <Circle
              className={`w-2 h-2 ${isPublished ? 'fill-green-500 text-green-500' : 'fill-slate-400 text-slate-400'}`}
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {isPublished ? 'Active' : 'Paused'}
            </span>
          </div>
        </div>
        <BotModeToggle mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {mode === 'live' ? <LiveModeView botId={botId} /> : <EditModeView botId={botId} />}
      </div>
    </div>
  );
}

