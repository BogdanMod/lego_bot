import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useDebugMe() {
  return useQuery({
    queryKey: ['debug-me'],
    queryFn: () => api.getDebugMe(),
    staleTime: 30 * 1000, // 30 seconds
    retry: 0, // Don't retry to avoid spamming
    enabled: import.meta.env.DEV, // Only in dev mode
  });
}


