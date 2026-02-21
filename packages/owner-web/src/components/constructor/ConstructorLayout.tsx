'use client';

import { Save, Loader2 } from 'lucide-react';
import { StatesPanel } from './StatesPanel';
import { StateEditor } from './StateEditor';
import { GraphView } from './GraphView';
import type { BotSchema } from '@/lib/templates/types';

interface ConstructorLayoutProps {
  schema: BotSchema;
  selectedState: string | null;
  onSelectState: (stateName: string) => void;
  onUpdateState: (stateName: string, updates: Partial<BotSchema['states'][string]>) => void;
  onAddState: () => void;
  onDeleteState: (stateName: string) => void;
  onSetInitialState: (stateName: string) => void;
  onManualSave?: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
}

export function ConstructorLayout({
  schema,
  selectedState,
  onSelectState,
  onUpdateState,
  onAddState,
  onDeleteState,
  onSetInitialState,
  onManualSave,
  isSaving = false,
  isSaved = true,
}: ConstructorLayoutProps) {
  const currentState = selectedState || schema.initialState;
  const isInitial = currentState === schema.initialState;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left Panel - Экранцы (список) */}
      <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800">
        <StatesPanel
          schema={schema}
          selectedState={selectedState}
          onSelectState={onSelectState}
          onAddState={onAddState}
          onDeleteState={onDeleteState}
        />
      </div>

      {/* Center - Редактор */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Редактирование бота
            </h1>
            <div className="flex items-center gap-3">
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">Сохранение...</span>
                </>
              ) : isSaved ? (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Сохранено
                </span>
              ) : (
                <>
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Есть несохранённые изменения
                  </span>
                  {onManualSave && (
                    <button
                      onClick={onManualSave}
                      disabled={isSaving}
                      className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Сохранить
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {currentState ? (
            <StateEditor
              schema={schema}
              stateName={currentState}
              onUpdate={(updates) => onUpdateState(currentState, updates)}
              onSetInitial={() => onSetInitialState(currentState)}
              isInitial={isInitial}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                  Выберите экран слева или добавьте новый
                </p>
                <button
                  onClick={onAddState}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
                >
                  Добавить экран
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Схема диалога (кто за кем идёт) */}
      <div className="w-80 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Схема диалога
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Стрелки: кнопка → следующий экран. Синяя рамка — выбранный экран.
          </p>
        </div>
        <div className="flex-1 min-h-0">
          <GraphView
            schema={schema}
            selectedState={selectedState}
            onNodeClick={onSelectState}
          />
        </div>
      </div>
    </div>
  );
}

