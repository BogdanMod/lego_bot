'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useSSEStream(botId: string | undefined) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!botId) return;

    const url = `/api/core/owner/bots/${botId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[SSE] Connected', { botId });
    };

    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Connection confirmed', data);
    });

    eventSource.addEventListener('event', (e) => {
      const data = JSON.parse(e.data);
      console.log('[SSE] Event received', data);
      
      // Invalidate relevant queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ['owner-section', botId] });
      queryClient.invalidateQueries({ queryKey: ['owner-events', botId] });
      queryClient.invalidateQueries({ queryKey: ['owner-customers', botId] });
      queryClient.invalidateQueries({ queryKey: ['owner-orders', botId] });
      queryClient.invalidateQueries({ queryKey: ['owner-leads', botId] });
    });

    eventSource.addEventListener('ping', () => {
      // Keep-alive ping, no action needed
    });

    eventSource.addEventListener('error', (e) => {
      console.error('[SSE] Error', e);
    });

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error', error);
      // EventSource will auto-reconnect
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [botId, queryClient]);
}


