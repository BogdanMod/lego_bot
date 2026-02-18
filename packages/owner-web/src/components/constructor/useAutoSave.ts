import { useEffect, useRef } from 'react';
import type { BotSchema } from '@/lib/templates/types';

export function useAutoSave(
  schema: BotSchema | null,
  onSave: (schema: BotSchema) => void,
  delay: number = 1500
) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!schema) return;

    const schemaString = JSON.stringify(schema);
    
    // Skip if unchanged
    if (schemaString === lastSavedRef.current) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onSave(schema);
      lastSavedRef.current = schemaString;
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [schema, onSave, delay]);
}

