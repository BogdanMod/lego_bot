import { Wrench } from 'lucide-react';
import { Button } from './ui/Button';

const WebApp = window.Telegram?.WebApp;

export function MaintenanceScreen({ message }: { message?: string | null }) {
  return (
    <div className="min-h-screen px-6 py-10 text-slate-900 dark:text-white">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          <Wrench size={28} />
        </div>
        <div className="mt-6 text-2xl font-semibold">Технические работы</div>
        <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {message || 'Мы обновляем сервис. Попробуйте зайти позже.'}
        </div>
        <div className="mt-8">
          <Button variant="secondary" onClick={() => WebApp?.close()}>
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
