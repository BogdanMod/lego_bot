'use client';

import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CabinetIndexPage() {
  const router = useRouter();
  const { data } = useOwnerAuth();

  useEffect(() => {
    if (!data?.bots || data.bots.length === 0) return;

    // Try to restore lastBotId from localStorage
    let targetBotId: string | undefined;
    if (typeof window !== 'undefined') {
      const lastBotId = localStorage.getItem('owner_lastBotId');
      if (lastBotId && data.bots.some((b) => b.botId === lastBotId)) {
        targetBotId = lastBotId;
      }
    }

    // Fallback to first available bot
    if (!targetBotId) {
      targetBotId = data.bots[0]?.botId;
    }

    if (targetBotId) {
      router.replace(`/cabinet/${targetBotId}/overview`);
    }
  }, [data, router]);

  return <div className="panel p-8">Подготовка кабинета...</div>;
}

