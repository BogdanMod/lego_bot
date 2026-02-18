'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ownerFetch, ownerUpdateBotSchema, type ApiError } from '@/lib/api';
import type { BotSchema } from '@/lib/templates/types';

type ViewMode = 'edit' | 'preview' | 'graph';

export function BotConstructorClient({ wizardEnabled }: { wizardEnabled: boolean }) {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;
  const queryClient = useQueryClient();
  const isMountedRef = useRef(true);
  
  // Diagnostic logging
  console.log('[constructor] render', { 
    botId, 
    wizardEnabled, 
    hasParams: !!params,
    renderId: Math.random().toString(36).substring(7)
  });
  
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [schema, setSchema] = useState<BotSchema | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [previewState, setPreviewState] = useState<string | null>(null);
  const [draggedButtonIndex, setDraggedButtonIndex] = useState<number | null>(null);
  
  // Safe state setters that check if component is mounted
  const safeSetState = <T,>(setter: (value: T | ((prev: T) => T)) => void, value: T | ((prev: T) => T)) => {
    if (isMountedRef.current) {
      setter(value);
    }
  };
  
  const safeToast = (fn: typeof toast.success, message: string) => {
    if (isMountedRef.current) {
      fn(message);
    }
  };

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
        safeSetState(setHasChanges, false);
        safeToast(toast.success, 'Схема бота обновлена');
      }
    },
    onError: (error: ApiError) => {
      if (isMountedRef.current) {
        safeToast(toast.error, error?.message || 'Ошибка при сохранении схемы');
      }
    },
  });

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log('[constructor] useEffect[botData] triggered', { 
      hasBotData: !!botData, 
      hasSchema: !!botData?.schema,
      botId 
    });
    
    if (!botData) return;
    
    if (botData.schema) {
      const loadedSchema = botData.schema as BotSchema;
      
      // Validate it's a proper schema
      if (loadedSchema && typeof loadedSchema === 'object' && loadedSchema.states && loadedSchema.initialState) {
        safeSetState(setSchema, loadedSchema);
        safeSetState(setSelectedState, (prev) => prev || loadedSchema.initialState);
        safeSetState(setPreviewState, (prev) => prev || loadedSchema.initialState);
      } else {
        console.error('Invalid schema structure:', botData);
        safeToast(toast.error, 'Неверная структура схемы бота. Создайте схему через Wizard.');
      }
    } else {
      // Bot exists but has no schema - create empty one
      const emptySchema: BotSchema = {
        version: 1,
        initialState: 'start',
        states: {
          start: {
            message: 'Добро пожаловать!',
            buttons: [],
          },
        },
      };
      safeSetState(setSchema, emptySchema);
      safeSetState(setSelectedState, (prev) => prev || 'start');
      safeSetState(setPreviewState, (prev) => prev || 'start');
      safeSetState(setHasChanges, true);
      safeToast(toast.info, 'Создана пустая схема. Настройте бота и сохраните.');
    }
  }, [botData]);

  if (isLoading) {
    return (
      <div className="panel p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !botData) {
    return (
      <div className="panel p-8">
        <div className="text-red-500">Ошибка загрузки бота</div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          Назад
        </button>
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="panel p-8">
        <div className="text-muted-foreground">Схема бота не найдена</div>
      </div>
    );
  }

  const handleSave = () => {
    if (!schema) return;
    updateSchemaMutation.mutate(schema);
  };

  const handleAddState = () => {
    if (!schema || !isMountedRef.current) return;
    const stateName = prompt('Введите название состояния (например: menu, help):');
    if (!stateName || !stateName.trim()) return;
    
    const trimmedName = stateName.trim();
    if (schema.states[trimmedName]) {
      safeToast(toast.error, 'Состояние с таким именем уже существует');
      return;
    }

    safeSetState(setSchema, {
      ...schema,
      states: {
        ...schema.states,
        [trimmedName]: {
          message: 'Новое сообщение',
          buttons: [],
        },
      },
    });
    safeSetState(setSelectedState, trimmedName);
    safeSetState(setHasChanges, true);
  };

  const handleDeleteState = (stateName: string) => {
    if (!schema || !isMountedRef.current) return;
    if (stateName === schema.initialState) {
      safeToast(toast.error, 'Нельзя удалить начальное состояние');
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

    safeSetState(setSchema, {
      ...schema,
      states: newStates,
    });
    
    if (selectedState === stateName) {
      safeSetState(setSelectedState, schema.initialState);
    }
    safeSetState(setHasChanges, true);
  };

  const handleUpdateState = (stateName: string, updates: Partial<BotSchema['states'][string]>) => {
    if (!schema || !isMountedRef.current) return;
    safeSetState(setSchema, {
      ...schema,
      states: {
        ...schema.states,
        [stateName]: {
          ...schema.states[stateName],
          ...updates,
        },
      },
    });
    safeSetState(setHasChanges, true);
  };

  const handleSetInitialState = (stateName: string) => {
    if (!schema || !isMountedRef.current) return;
    safeSetState(setSchema, {
      ...schema,
      initialState: stateName,
    });
    safeSetState(setHasChanges, true);
  };

  const handleButtonDragStart = (index: number) => {
    if (isMountedRef.current) {
      setDraggedButtonIndex(index);
    }
  };

  const handleButtonDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
  };

  const handleButtonDrop = (targetIndex: number) => {
    if (draggedButtonIndex === null || !selectedState || !schema || !isMountedRef.current) return;
    
    const buttons = [...(schema.states[selectedState].buttons || [])];
    const draggedButton = buttons[draggedButtonIndex];
    buttons.splice(draggedButtonIndex, 1);
    buttons.splice(targetIndex, 0, draggedButton);
    
    handleUpdateState(selectedState, { buttons });
    if (isMountedRef.current) {
      setDraggedButtonIndex(null);
    }
  };

  const handleAddButton = () => {
    if (!selectedState || !schema) return;
    const buttonText = prompt('Текст кнопки:');
    if (!buttonText?.trim()) return;
    
    const buttons = schema.states[selectedState].buttons || [];
    handleUpdateState(selectedState, {
      buttons: [
        ...buttons,
        {
          text: buttonText.trim(),
          nextState: schema.initialState,
        },
      ],
    });
  };

  // Graph visualization data
  const graphData = useMemo(() => {
    if (!schema) return { nodes: [], edges: [] };
    
    const nodes = Object.keys(schema.states).map(stateName => ({
      id: stateName,
      label: stateName,
      isInitial: stateName === schema.initialState,
    }));
    
    const edges: Array<{ from: string; to: string; label: string }> = [];
    Object.entries(schema.states).forEach(([stateName, state]) => {
      state.buttons?.forEach(button => {
        edges.push({
          from: stateName,
          to: button.nextState,
          label: button.text,
        });
      });
    });
    
    return { nodes, edges };
  }, [schema]);

  const states = schema ? Object.keys(schema.states) : [];
  const currentState = selectedState && schema ? schema.states[selectedState] : null;
  const previewStateData = previewState && schema ? schema.states[previewState] : null;

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
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => {
                if (isMountedRef.current) {
                  setViewMode('edit');
                }
              }}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'edit'
                  ? 'bg-white dark:bg-slate-700 shadow'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Редактор
            </button>
            <button
              onClick={() => {
                if (schema && isMountedRef.current) {
                  setViewMode('preview');
                  safeSetState(setPreviewState, schema.initialState);
                }
              }}
              disabled={!schema}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'preview'
                  ? 'bg-white dark:bg-slate-700 shadow'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              } disabled:opacity-50`}
            >
              Предпросмотр
            </button>
            <button
              onClick={() => {
                if (isMountedRef.current) {
                  setViewMode('graph');
                }
              }}
              className={`px-3 py-1 rounded text-sm ${
                viewMode === 'graph'
                  ? 'bg-white dark:bg-slate-700 shadow'
                  : 'hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Схема
            </button>
          </div>
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

      {viewMode === 'edit' && (
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
            
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {states.map((stateName) => (
                <div
                  key={stateName}
                  className={`p-2 rounded cursor-pointer transition-colors ${
                    selectedState === stateName
                      ? 'bg-primary text-white'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => {
                    if (isMountedRef.current) {
                      setSelectedState(stateName);
                    }
                  }}
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
                        onClick={handleAddButton}
                        className="text-sm px-2 py-1 bg-primary text-white rounded hover:bg-primary/90"
                      >
                        + Добавить кнопку
                      </button>
                    </div>

                    <div className="space-y-2">
                      {currentState.buttons?.map((button, index) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => handleButtonDragStart(index)}
                          onDragOver={(e) => handleButtonDragOver(e, index)}
                          onDrop={() => handleButtonDrop(index)}
                          className={`flex items-center gap-2 p-2 border rounded cursor-move ${
                            draggedButtonIndex === index ? 'opacity-50' : ''
                          }`}
                        >
                          <span className="text-slate-400 cursor-grab">⋮⋮</span>
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
      )}

      {viewMode === 'preview' && schema && (
        <div className="panel p-6 max-w-2xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Предпросмотр бота</h2>
            <button
              onClick={() => {
                if (isMountedRef.current) {
                  safeSetState(setPreviewState, schema.initialState);
                }
              }}
              className="text-sm px-3 py-1 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600"
            >
              Сбросить
            </button>
          </div>
          
          {previewStateData ? (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 min-h-[400px]">
              <div className="bg-white dark:bg-slate-800 rounded-lg p-4 shadow mb-4">
                <div className="text-sm text-muted-foreground mb-2">Бот:</div>
                <div className="whitespace-pre-wrap">{previewStateData.message || 'Нет сообщения'}</div>
              </div>
              
              {previewStateData.buttons && previewStateData.buttons.length > 0 && (
                <div className="space-y-2">
                  {previewStateData.buttons.map((button, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        if (schema.states[button.nextState] && isMountedRef.current) {
                          safeSetState(setPreviewState, button.nextState);
                        }
                      }}
                      className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-left"
                    >
                      {button.text}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="mt-4 text-xs text-muted-foreground">
                Текущее состояние: <span className="font-medium">{previewState || 'не выбрано'}</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Выберите состояние для предпросмотра
            </div>
          )}
        </div>
      )}

      {viewMode === 'graph' && schema && (
        <div className="panel p-6">
          <h2 className="text-lg font-semibold mb-4">Визуальная схема переходов</h2>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-6 min-h-[500px] overflow-auto">
            {graphData.nodes.length > 0 ? (
              <div className="relative" style={{ minHeight: '400px' }}>
                {/* Nodes */}
                {graphData.nodes.map((node, index) => {
                const row = Math.floor(index / 3);
                const col = index % 3;
                const x = 150 + col * 250;
                const y = 100 + row * 150;
                
                return (
                  <div
                    key={node.id}
                    className="absolute"
                    style={{ left: `${x}px`, top: `${y}px` }}
                  >
                    <div
                      className={`px-4 py-2 rounded-lg border-2 ${
                        node.isInitial
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      <div className="font-medium text-sm">
                        {node.isInitial && '🚀 '}
                        {node.label}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Edges (arrows) */}
              {graphData.edges.map((edge, index) => {
                const fromNode = graphData.nodes.findIndex(n => n.id === edge.from);
                const toNode = graphData.nodes.findIndex(n => n.id === edge.to);
                
                if (fromNode === -1 || toNode === -1) return null;
                
                const fromRow = Math.floor(fromNode / 3);
                const fromCol = fromNode % 3;
                const toRow = Math.floor(toNode / 3);
                const toCol = toNode % 3;
                
                const fromX = 150 + fromCol * 250 + 80;
                const fromY = 100 + fromRow * 150 + 20;
                const toX = 150 + toCol * 250 + 80;
                const toY = 100 + toRow * 150 + 20;
                
                const dx = toX - fromX;
                const dy = toY - fromY;
                const length = Math.sqrt(dx * dx + dy * dy);
                
                return (
                  <svg
                    key={index}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${Math.min(fromX, toX)}px`,
                      top: `${Math.min(fromY, toY)}px`,
                      width: `${Math.abs(dx) || 1}px`,
                      height: `${Math.abs(dy) || 1}px`,
                    }}
                  >
                    <defs>
                      <marker
                        id={`arrowhead-${index}`}
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="3"
                        orient="auto"
                      >
                        <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
                      </marker>
                    </defs>
                    <line
                      x1={dx < 0 ? Math.abs(dx) : 0}
                      y1={dy < 0 ? Math.abs(dy) : 0}
                      x2={dx < 0 ? 0 : Math.abs(dx)}
                      y2={dy < 0 ? 0 : Math.abs(dy)}
                      stroke="#64748b"
                      strokeWidth="2"
                      markerEnd={`url(#arrowhead-${index})`}
                    />
                    {Math.abs(dx) > 20 && Math.abs(dy) > 20 && (
                      <text
                        x={Math.abs(dx) / 2}
                        y={Math.abs(dy) / 2 - 5}
                        fontSize="10"
                        fill="#64748b"
                        textAnchor="middle"
                      >
                        {edge.label.length > 15 ? edge.label.substring(0, 15) + '...' : edge.label}
                      </text>
                    )}
                  </svg>
                );
              })}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Нет состояний для отображения
              </div>
            )}
            
            <div className="mt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary rounded"></div>
                  <span>Начальное состояние</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded"></div>
                  <span>Обычное состояние</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
