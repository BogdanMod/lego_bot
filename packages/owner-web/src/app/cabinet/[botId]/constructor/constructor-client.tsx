'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerFetch, ownerUpdateBotSchema, type ApiError } from '@/lib/api';
import type { BotSchema } from '@/lib/templates/types';
import { ConstructorLayout } from '@/components/constructor/ConstructorLayout';
import { useAutoSave } from '@/components/constructor/useAutoSave';
import { useKeyboardShortcuts } from '@/components/constructor/useKeyboardShortcuts';

export function BotConstructorClient({ wizardEnabled }: { wizardEnabled: boolean }) {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [schema, setSchema] = useState<BotSchema | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  const { data: botData, isLoading, error } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
    enabled: !!botId,
    retry: 1,
    staleTime: 30_000,
  });

  const updateSchemaMutation = useMutation({
    mutationFn: async (newSchema: BotSchema) => {
      return ownerUpdateBotSchema(botId, newSchema);
    },
    onSuccess: () => {
      if (isMountedRef.current) {
        queryClient.invalidateQueries({ queryKey: ['bot', botId] });
        setIsSaving(false);
        setIsSaved(true);
      }
    },
    onError: (error: ApiError) => {
      if (isMountedRef.current) {
        setIsSaving(false);
        toast.error(error?.message || 'Failed to save schema');
      }
    },
  });

  // Initialize schema from bot data
  useEffect(() => {
    if (!botData) return;
    
    if (botData.schema) {
      const loadedSchema = botData.schema as BotSchema;
      
      if (loadedSchema && typeof loadedSchema === 'object' && loadedSchema.states && loadedSchema.initialState) {
        setSchema(loadedSchema);
        setSelectedState((prev) => prev || loadedSchema.initialState);
        setIsSaved(true);
      } else {
        console.error('Invalid schema structure:', botData);
        toast.error('Invalid bot schema. Please recreate via Wizard.');
      }
    } else {
      // Create empty schema
      const emptySchema: BotSchema = {
        version: 1,
        initialState: 'start',
        states: {
          start: {
            message: 'Welcome!',
            buttons: [],
          },
        },
      };
      setSchema(emptySchema);
      setSelectedState('start');
      setIsSaved(false);
    }
  }, [botData]);

  // Auto-save with debounce
  const handleAutoSave = (newSchema: BotSchema) => {
    if (!isMountedRef.current) return;
    setIsSaving(true);
    setIsSaved(false);
    updateSchemaMutation.mutate(newSchema);
  };

  useAutoSave(schema, handleAutoSave, 1500);

  // Manual save handler
  const handleManualSave = () => {
    if (!schema) return;
    setIsSaving(true);
    setIsSaved(false);
    updateSchemaMutation.mutate(schema);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleManualSave,
    onSearch: () => {
      // TODO: Implement state search
      toast.info('State search coming soon');
    },
    onEscape: () => {
      // TODO: Implement escape handler
    },
  });

  // Cleanup
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Computed values - before early returns
  const hasSchema = !!schema;

  // Early returns
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 dark:border-slate-800 border-t-slate-900 dark:border-t-slate-100 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading bot...</p>
        </div>
      </div>
    );
  }

  if (error || !botData) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">Failed to load bot</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!hasSchema) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">No schema found</p>
          <button
            onClick={() => router.push(`/cabinet/bots/new`)}
            className="px-4 py-2 text-sm font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Create schema
          </button>
        </div>
      </div>
    );
  }

  // Handlers
  const handleUpdateState = (stateName: string, updates: Partial<BotSchema['states'][string]>) => {
    if (!schema || !isMountedRef.current) return;
    
    setSchema({
      ...schema,
      states: {
        ...schema.states,
        [stateName]: {
          ...schema.states[stateName],
          ...updates,
        },
      },
    });
    setIsSaved(false);
  };

  const handleAddState = () => {
    if (!schema || !isMountedRef.current) return;
    
    const stateName = prompt('Enter state name (e.g., menu, help):');
    if (!stateName || !stateName.trim()) return;
    
    const trimmedName = stateName.trim();
    if (schema.states[trimmedName]) {
      toast.error('State with this name already exists');
      return;
    }

    setSchema({
      ...schema,
      states: {
        ...schema.states,
        [trimmedName]: {
          message: 'New message',
          buttons: [],
        },
      },
    });
    setSelectedState(trimmedName);
    setIsSaved(false);
  };

  const handleDeleteState = (stateName: string) => {
    if (!schema || !isMountedRef.current) return;
    
    if (stateName === schema.initialState) {
      toast.error('Cannot delete initial state');
      return;
    }
    
    if (!confirm(`Delete state "${stateName}"? All references will be removed.`)) {
      return;
    }

    const newStates = { ...schema.states };
    delete newStates[stateName];

    // Remove buttons pointing to deleted state
    Object.keys(newStates).forEach((key) => {
      if (newStates[key].buttons) {
        newStates[key].buttons = newStates[key].buttons!.filter(
          (btn) => btn.nextState !== stateName
        );
      }
    });

    setSchema({
      ...schema,
      states: newStates,
    });
    
    if (selectedState === stateName) {
      setSelectedState(schema.initialState);
    }
    setIsSaved(false);
  };

  const handleSetInitialState = (stateName: string) => {
    if (!schema || !isMountedRef.current) return;
    
    setSchema({
      ...schema,
      initialState: stateName,
    });
    setIsSaved(false);
  };

  return (
    <ConstructorLayout
      schema={schema}
      selectedState={selectedState}
      onSelectState={setSelectedState}
      onUpdateState={handleUpdateState}
      onAddState={handleAddState}
      onDeleteState={handleDeleteState}
      onSetInitialState={handleSetInitialState}
      onManualSave={handleManualSave}
      isSaving={isSaving}
      isSaved={isSaved}
    />
  );
}
