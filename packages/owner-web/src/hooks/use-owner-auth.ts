'use client';

import { useQuery } from '@tanstack/react-query';
import { ownerMe } from '@/lib/api';

export function useOwnerAuth() {
  return useQuery({
    queryKey: ['owner-me'],
    queryFn: ownerMe,
    retry: false,
  });
}


