'use client';

import { Button } from '@/components/ui/button';
import { Play, Edit } from 'lucide-react';

type BotMode = 'live' | 'edit';

interface BotModeToggleProps {
  mode: BotMode;
  onModeChange: (mode: BotMode) => void;
}

export function BotModeToggle({ mode, onModeChange }: BotModeToggleProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
      <button
        onClick={() => onModeChange('live')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
          mode === 'live'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <Play className="w-3.5 h-3.5" />
        LIVE
      </button>
      <button
        onClick={() => onModeChange('edit')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
          mode === 'edit'
            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
        }`}
      >
        <Edit className="w-3.5 h-3.5" />
        EDIT
      </button>
    </div>
  );
}

