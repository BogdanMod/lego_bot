'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerBotMe } from '@/lib/api';
import { useParams } from 'next/navigation';

export function useBotContext() {
  const params = useParams();
  const botId = params?.botId as string | undefined;

  return useQuery({
    queryKey: ['owner-bot-me', botId],
    queryFn: () => botId ? ownerBotMe(botId) : null,
    enabled: !!botId,
    staleTime: 30_000,
  });
}

