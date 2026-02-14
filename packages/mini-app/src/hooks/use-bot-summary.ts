import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';

export function useBotSummary() {
  return useQuery({
    queryKey: ['bot-summary'],
    queryFn: () => api.getBotSummary(),
    staleTime: 10 * 1000, // 10 seconds
  });
}

export function useInvalidateBotSummary() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['bot-summary'] });
    queryClient.invalidateQueries({ queryKey: ['bots'] });
  };
}

