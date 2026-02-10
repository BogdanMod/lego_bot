import { Cpu, Globe, Moon, Sun } from 'lucide-react';
import { Button } from './ui/Button';
import { useTheme } from '../hooks/useTheme';
import { useLanguage } from '../hooks/useLanguage';

export function GlobalHeader() {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <div className="sticky top-0 z-30">
      <div className="mx-auto max-w-md px-4 pt-4">
        <div
          className={[
            'flex items-center justify-between rounded-[2rem] border px-4 py-3',
            'bg-white/70 border-slate-200 shadow-lg backdrop-blur',
            'dark:bg-slate-900/70 dark:border-slate-800',
          ].join(' ')}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
              <Cpu size={18} />
            </div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{t.app.name}</div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
              onClick={toggleTheme}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Globe size={16} />}
              onClick={toggleLanguage}
            >
              {language}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

