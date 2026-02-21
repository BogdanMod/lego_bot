'use client';

import { useState } from 'react';
import { Plus, Rocket } from 'lucide-react';
import type { BotSchema } from '@/lib/templates/types';

interface StatesPanelProps {
  schema: BotSchema;
  selectedState: string | null;
  onSelectState: (stateName: string) => void;
  onAddState: () => void;
  onDeleteState: (stateName: string) => void;
}

export function StatesPanel({
  schema,
  selectedState,
  onSelectState,
  onAddState,
  onDeleteState,
}: StatesPanelProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const states = Object.keys(schema.states);

  function messagePreview(stateName: string, maxLen = 28): string {
    const msg = schema.states[stateName]?.message ?? '';
    const firstLine = msg.split('\n')[0].trim();
    if (!firstLine) return stateName;
    return firstLine.length <= maxLen ? firstLine : firstLine.slice(0, maxLen - 1) + '…';
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Экраны
          </h2>
          <button
            onClick={onAddState}
            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            title="Добавить экран"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {states.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Пока нет экранов
            </p>
            <button
              onClick={onAddState}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
            >
              Добавить первый экран
            </button>
          </div>
        ) : (
          <div className="py-2">
            {states.map((stateName) => {
              const isSelected = selectedState === stateName;
              const isInitial = schema.initialState === stateName;
              const buttonCount = schema.states[stateName].buttons?.length || 0;
              const preview = messagePreview(stateName);

              return (
                <div
                  key={stateName}
                  className={`group relative px-4 py-2.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 border-l-2 border-slate-900 dark:border-slate-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 border-l-2 border-transparent'
                  }`}
                  onClick={() => onSelectState(stateName)}
                  onMouseEnter={() => setHoveredState(stateName)}
                  onMouseLeave={() => setHoveredState(null)}
                >
                  <div className="flex items-center gap-2">
                    {isInitial && (
                      <Rocket className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm font-medium block truncate ${
                        isSelected
                          ? 'text-slate-900 dark:text-slate-100'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                      title={preview}
                    >
                      {preview}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {buttonCount} {buttonCount === 1 ? 'кнопка' : buttonCount < 5 ? 'кнопки' : 'кнопок'}
                    </span>
                    {hoveredState === stateName && !isInitial && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteState(stateName);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

