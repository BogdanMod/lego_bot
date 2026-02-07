import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => toggleTheme()}
      className="p-2.5 rounded-2xl border transition-all active:scale-90 bg-white border-slate-100 text-slate-400 shadow-sm hover:shadow-lg dark:bg-slate-900 dark:border-slate-800 dark:text-amber-400 dark:shadow-inner"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

