'use client';

import { useOwnerAuth } from '@/hooks/use-owner-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CabinetIndexPage() {
  const router = useRouter();
  const { data } = useOwnerAuth();

  useEffect(() => {
    if (data?.bots?.[0]?.botId) {
      router.replace(`/cabinet/${data.bots[0].botId}/overview`);
    }
  }, [data, router]);

  return <div className="panel p-8">Подготовка кабинета...</div>;
}

