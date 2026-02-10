import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useTheme } from '../hooks/useTheme';
import { formatRelativeTime } from '../utils/debounce';

interface SyncIndicatorProps {
  status: 'idle' | 'syncing' | 'error';
  lastSyncTime: number | null;
  error: string | null;
  onRetry?: () => void;
}

export function SyncIndicator({ status, lastSyncTime, error, onRetry }: SyncIndicatorProps) {
  const { t } = useLanguage();
  const { theme } = useTheme();

  if (status === 'idle' && !lastSyncTime) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${
        status === 'error'
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : status === 'syncing'
          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      } ${theme === 'dark' ? 'opacity-90' : ''}`}
    >
      {status === 'syncing' && (
        <>
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-indigo-600" />
          <span>{t.editor.saving}</span>
        </>
      )}
      {status === 'idle' && lastSyncTime && (
        <>
          <CheckCircle2 size={14} />
          <span>Сохранено {formatRelativeTime(lastSyncTime)}</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle size={14} />
          <span>{error || 'Ошибка'}</span>
          {onRetry && (
            <button onClick={onRetry} className="ml-2 underline">
              Повторить
            </button>
          )}
        </>
      )}
    </div>
  );
}

