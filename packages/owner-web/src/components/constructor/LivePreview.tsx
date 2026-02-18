'use client';

import { useState, useEffect } from 'react';
import { Rocket } from 'lucide-react';
import type { BotSchema } from '@/lib/templates/types';

interface LivePreviewProps {
  schema: BotSchema;
}

export function LivePreview({ schema }: LivePreviewProps) {
  const [currentState, setCurrentState] = useState<string>(schema.initialState);

  // Reset to initial state when schema changes
  useEffect(() => {
    setCurrentState(schema.initialState);
  }, [schema.initialState]);

  const state = schema.states[currentState];
  const buttons = state?.buttons || [];

  const handleButtonClick = (nextState: string) => {
    if (schema.states[nextState]) {
      setCurrentState(nextState);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Preview
          </h2>
          <button
            onClick={() => setCurrentState(schema.initialState)}
            className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <Rocket className="w-3 h-3" />
            Reset
          </button>
        </div>
      </div>

      {/* Telegram-like chat */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-md mx-auto space-y-4">
          {/* Bot message */}
          <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Bot
              </span>
            </div>
            <div className="flex-1">
              <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                  {state?.message || 'No message'}
                </p>
              </div>
              {buttons.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {buttons.map((button, index) => (
                    <button
                      key={index}
                      onClick={() => handleButtonClick(button.nextState)}
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {button.text || 'Untitled button'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* State indicator */}
          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500"></span>
              State: {currentState}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

