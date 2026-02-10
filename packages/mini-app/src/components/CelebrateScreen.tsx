import { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

export interface CelebrateScreenProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function CelebrateScreen({ isOpen, onComplete }: CelebrateScreenProps) {
  const { t } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-slate-950 flex items-center justify-center p-6 animate-in fade-in">
      <div className="text-center">
        <div className="mx-auto w-28 h-28 bg-emerald-50 dark:bg-emerald-950 rounded-[3rem] flex items-center justify-center">
          <CheckCircle2 size={56} className="text-emerald-600 dark:text-emerald-400 animate-bounce" />
        </div>
        <div className="mt-10 text-5xl font-black text-slate-900 dark:text-white">{t.publish.success}</div>
        <div className="mt-4 text-base text-slate-600 dark:text-slate-300">{t.publish.successMessage}</div>
      </div>
    </div>
  );
}

