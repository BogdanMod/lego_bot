'use client';

import { useWorkMode } from '@/contexts/mode-context';
import { useRouter, usePathname } from 'next/navigation';

export function ModeToggle() {
  const { mode, setMode } = useWorkMode();
  const router = useRouter();
  const pathname = usePathname();

  const handleModeChange = (newMode: 'edit' | 'manage') => {
    setMode(newMode);
    
    // Navigate based on mode
    if (newMode === 'edit') {
      if (pathname?.startsWith('/cabinet/') && pathname.includes('/constructor')) {
        // Already in constructor, stay there
        return;
      }
      router.push('/cabinet/bots?mode=edit');
    } else {
      if (pathname?.startsWith('/cabinet/') && !pathname.includes('/constructor')) {
        // Already in manage mode, stay there
        return;
      }
      router.push('/cabinet?mode=manage');
    }
  };

  return (
    <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
      <button
        onClick={() => handleModeChange('manage')}
        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'manage'
            ? 'text-slate-900 dark:text-slate-100 border-b-2 border-slate-900 dark:border-slate-100'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        Работа
      </button>
      <button
        onClick={() => handleModeChange('edit')}
        className={`px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'edit'
            ? 'text-slate-900 dark:text-slate-100 border-b-2 border-slate-900 dark:border-slate-100'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
        }`}
      >
        Настройка
      </button>
    </div>
  );
}

