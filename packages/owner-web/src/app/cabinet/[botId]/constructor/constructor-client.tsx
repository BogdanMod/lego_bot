'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerFetch, ownerUpdateBotSchema, type ApiError } from '@/lib/api';
import type { BotSchema } from '@/lib/templates/types';

export function BotConstructorClient({ wizardEnabled }: { wizardEnabled: boolean }) {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const queryClient = useQueryClient();
  
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [schema, setSchema] = useState<BotSchema | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: botData, isLoading } = useQuery({
    queryKey: ['bot', botId],
    queryFn: () => ownerFetch<any>(`/api/owner/bots/${botId}`),
  });

  const updateSchemaMutation = useMutation({
    mutationFn: async (newSchema: BotSchema) => {
      return ownerUpdateBotSchema(botId, newSchema);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] });
      setHasChanges(false);
      toast.success('Схема бота обновлена');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при сохранении схемы');
    },
  });

  useEffect(() => {
    if (botData?.schema) {
      setSchema(botData.schema as BotSchema);
      if (!selectedState && botData.schema.initialState) {
        setSelectedState(botData.schema.initialState);
      }
    }
  }, [botData, selectedState]);

  if (isLoading || !schema) {
    return (
      <div className="panel p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (!schema) return;
    updateSchemaMutation.mutate(schema);
  };

  const handleAddState = () => {
    if (!schema) return;
    const stateName = prompt('Введите название состояния (например: menu, help):');
    if (!stateName || !stateName.trim()) return;
    
    const trimmedName = stateName.trim();
    if (schema.states[trimmedName]) {
      toast.error('Состояние с таким именем уже существует');
      return;
    }

    setSchema({
      ...schema,
      states: {
        ...schema.states,
        [trimmedName]: {
          message: 'Новое сообщение',
          buttons: [],
        },
      },
    });
    setSelectedState(trimmedName);
    setHasChanges(true);
  };

  const handleDeleteState = (stateName: string) => {
    if (!schema) return;
    if (stateName === schema.initialState) {
      toast.error('Нельзя удалить начальное состояние');
      return;
    }
    
    if (!confirm(`Удалить состояние "${stateName}"? Все ссылки на него будут удалены.`)) {
      return;
    }

    const newStates = { ...schema.states };
    delete newStates[stateName];

    // Remove buttons pointing to deleted state
    Object.keys(newStates).forEach(key => {
      if (newStates[key].buttons) {
        newStates[key].buttons = newStates[key].buttons!.filter(
          btn => btn.nextState !== stateName
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
    setHasChanges(true);
  };

  const handleUpdateState = (stateName: string, updates: Partial<BotSchema['states'][string]>) => {
    if (!schema) return;
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
    setHasChanges(true);
  };

  const handleSetInitialState = (stateName: string) => {
    if (!schema) return;
    setSchema({
      ...schema,
      initialState: stateName,
    });
    setHasChanges(true);
  };

  const states = Object.keys(schema.states);
  const currentState = selectedState ? schema.states[selectedState] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Конструктор бота</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Редактируйте сообщения, кнопки и состояния вашего бота
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <span className="text-sm text-amber-600 dark:text-amber-400 self-center">
              Есть несохраненные изменения
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateSchemaMutation.isPending}
            className="px-4 py-2 bg-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90"
          >
            {updateSchemaMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-6">
        {/* Sidebar: States list */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-medium">Состояния</h2>
            <button
              onClick={handleAddState}
              className="text-sm px-2 py-1 bg-primary text-white rounded hover:bg-primary/90"
            >
              + Добавить
            </button>
          </div>
          
          <div className="space-y-1">
            {states.map((stateName) => (
              <div
                key={stateName}
                className={`p-2 rounded cursor-pointer transition-colors ${
                  selectedState === stateName
                    ? 'bg-primary text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => setSelectedState(stateName)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {schema.initialState === stateName && (
                      <span className="text-xs">🚀</span>
                    )}
                    <span className="font-medium text-sm">{stateName}</span>
                  </div>
                  {stateName !== schema.initialState && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteState(stateName);
                      }}
                      className="text-xs opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  {schema.states[stateName].buttons?.length || 0} кнопок
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main: State editor */}
        {currentState && selectedState ? (
          <div className="panel p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Редактирование: {selectedState}</h2>
                {selectedState !== schema.initialState && (
                  <button
                    onClick={() => handleSetInitialState(selectedState)}
                    className="text-sm px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
                  >
                    Сделать начальным
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Сообщение
                  </label>
                  <textarea
                    value={currentState.message || ''}
                    onChange={(e) =>
                      handleUpdateState(selectedState, { message: e.target.value })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-primary min-h-[120px]"
                    placeholder="Введите текст сообщения..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium">Кнопки</label>
                    <button
                      onClick={() => {
                        const buttonText = prompt('Текст кнопки:');
                        if (!buttonText?.trim()) return;
                        
                        const nextState = prompt('Состояние при нажатии (или оставьте пустым):');
                        const buttons = currentState.buttons || [];
                        handleUpdateState(selectedState, {
                          buttons: [
                            ...buttons,
                            {
                              text: buttonText.trim(),
                              nextState: nextState?.trim() || selectedState,
                            },
                          ],
                        });
                      }}
                      className="text-sm px-2 py-1 bg-primary text-white rounded hover:bg-primary/90"
                    >
                      + Добавить кнопку
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentState.buttons?.map((button, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border rounded"
                      >
                        <input
                          type="text"
                          value={button.text}
                          onChange={(e) => {
                            const buttons = [...(currentState.buttons || [])];
                            buttons[index] = { ...button, text: e.target.value };
                            handleUpdateState(selectedState, { buttons });
                          }}
                          className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm"
                          placeholder="Текст кнопки"
                        />
                        <select
                          value={button.nextState}
                          onChange={(e) => {
                            const buttons = [...(currentState.buttons || [])];
                            buttons[index] = { ...button, nextState: e.target.value };
                            handleUpdateState(selectedState, { buttons });
                          }}
                          className="rounded border border-border bg-background px-2 py-1 text-sm"
                        >
                          {states.map((state) => (
                            <option key={state} value={state}>
                              {state}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const buttons = (currentState.buttons || []).filter(
                              (_, i) => i !== index
                            );
                            handleUpdateState(selectedState, { buttons });
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {(!currentState.buttons || currentState.buttons.length === 0) && (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Нет кнопок. Добавьте кнопку для навигации.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="panel p-8 text-center text-muted-foreground">
            Выберите состояние для редактирования
          </div>
        )}
      </div>
    </div>
  );
}

