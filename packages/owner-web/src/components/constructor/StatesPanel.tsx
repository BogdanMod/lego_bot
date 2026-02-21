'use client';

import { useMemo, useState } from 'react';
import { Plus, Rocket, ArrowRight } from 'lucide-react';
import type { BotSchema } from '@/lib/templates/types';

interface StatesPanelProps {
  schema: BotSchema;
  selectedState: string | null;
  onSelectState: (stateName: string) => void;
  onAddState: () => void;
  onDeleteState: (stateName: string) => void;
}

/** Порядок экранов по ходу диалога: от старта, затем по переходам (BFS). */
function flowOrder(schema: BotSchema): string[] {
  const all = Object.keys(schema.states);
  if (!all.length) return [];
  const order: string[] = [];
  const seen = new Set<string>();
  const queue = [schema.initialState];
  while (queue.length) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    order.push(name);
    const buttons = schema.states[name]?.buttons ?? [];
    buttons.forEach((b) => {
      if (b.nextState && !seen.has(b.nextState)) queue.push(b.nextState);
    });
  }
  all.forEach((s) => {
    if (!seen.has(s)) order.push(s);
  });
  return order;
}

export function StatesPanel({
  schema,
  selectedState,
  onSelectState,
  onAddState,
  onDeleteState,
}: StatesPanelProps) {
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  const statesOrdered = useMemo(() => flowOrder(schema), [schema]);

  function messagePreview(stateName: string, maxLen = 28): string {
    const msg = schema.states[stateName]?.message ?? '';
    const firstLine = msg.split('\n')[0].trim();
    if (!firstLine) return stateName;
    return firstLine.length <= maxLen ? firstLine : firstLine.slice(0, maxLen - 1) + '…';
  }

  /** Куда ведут кнопки: список пар «текст кнопки → превью экрана». */
  function getTransitions(stateName: string): { buttonText: string; targetPreview: string }[] {
    const buttons = schema.states[stateName]?.buttons ?? [];
    return buttons.map((b) => ({
      buttonText: b.text || '—',
      targetPreview: messagePreview(b.nextState, 20),
    }));
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Экраны (по порядку диалога)
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
        {statesOrdered.length === 0 ? (
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
            {statesOrdered.map((stateName) => {
              const isSelected = selectedState === stateName;
              const isInitial = schema.initialState === stateName;
              const buttonCount = schema.states[stateName].buttons?.length || 0;
              const preview = messagePreview(stateName);
              const transitions = getTransitions(stateName);

              return (
                <div
                  key={stateName}
                  className={`group relative px-4 py-2.5 cursor-pointer transition-colors border-l-2 ${
                    isSelected
                      ? 'bg-slate-100 dark:bg-slate-800 border-slate-900 dark:border-slate-100'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-900/50 border-transparent'
                  }`}
                  onClick={() => onSelectState(stateName)}
                  onMouseEnter={() => setHoveredState(stateName)}
                  onMouseLeave={() => setHoveredState(null)}
                >
                  <div className="flex items-center gap-2">
                    {isInitial && (
                      <span title="Старт"><Rocket className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" /></span>
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
                  <div className="flex items-center justify-between mt-1 flex-wrap gap-x-2">
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
                  {transitions.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {transitions.map((t, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"
                          title={`Кнопка «${t.buttonText}» ведёт на экран`}
                        >
                          <ArrowRight className="w-3 h-3 flex-shrink-0 text-slate-400 dark:text-slate-500" />
                          <span className="truncate">
                            {t.buttonText} → {t.targetPreview}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

