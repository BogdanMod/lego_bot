'use client';

import { useState } from 'react';
import { Eye, Network, Save, Loader2 } from 'lucide-react';
import { StatesPanel } from './StatesPanel';
import { StateEditor } from './StateEditor';
import { LivePreview } from './LivePreview';
import { GraphView } from './GraphView';
import type { BotSchema } from '@/lib/templates/types';

type RightPanelMode = 'preview' | 'graph';

interface ConstructorLayoutProps {
  schema: BotSchema;
  selectedState: string | null;
  onSelectState: (stateName: string) => void;
  onUpdateState: (stateName: string, updates: Partial<BotSchema['states'][string]>) => void;
  onAddState: () => void;
  onDeleteState: (stateName: string) => void;
  onSetInitialState: (stateName: string) => void;
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
  isSaving = false,
  isSaved = true,
}: ConstructorLayoutProps) {
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>('preview');

  const currentState = selectedState || schema.initialState;
  const isInitial = currentState === schema.initialState;

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Left Panel - States */}
      <div className="w-64 flex-shrink-0">
        <StatesPanel
          schema={schema}
          selectedState={selectedState}
          onSelectState={onSelectState}
          onAddState={onAddState}
          onDeleteState={onDeleteState}
        />
      </div>

      {/* Center - Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Bot Constructor
            </h1>
            <div className="flex items-center gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Saving...
                  </span>
                </>
              ) : isSaved ? (
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  Saved
                </span>
              ) : (
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              )}
            </div>
          </div>

          {/* Right panel toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setRightPanelMode('preview')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                rightPanelMode === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Eye className="w-3.5 h-3.5 inline mr-1.5" />
              Preview
            </button>
            <button
              onClick={() => setRightPanelMode('graph')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                rightPanelMode === 'graph'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Network className="w-3.5 h-3.5 inline mr-1.5" />
              Graph
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden">
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
                  Select a state to edit
                </p>
                <button
                  onClick={onAddState}
                  className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline"
                >
                  Add first state
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Preview/Graph */}
      <div className="w-96 flex-shrink-0 border-l border-slate-200 dark:border-slate-800">
        {rightPanelMode === 'preview' ? (
          <LivePreview schema={schema} />
        ) : (
          <GraphView
            schema={schema}
            onNodeClick={onSelectState}
            selectedState={selectedState}
          />
        )}
      </div>
    </div>
  );
}

