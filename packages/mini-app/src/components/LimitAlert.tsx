import { translations } from '../utils/translations';
import { getLanguage } from '../utils/storage';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

export interface LimitAlertProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function LimitAlert({ isOpen, onClose, onUpgrade }: LimitAlertProps) {
  if (!isOpen) return null;

  const t = translations[getLanguage()];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm animate-in zoom-in">
        <Card
          className={[
            'border-0 shadow-2xl',
            'bg-gradient-to-br from-indigo-600 to-purple-700 text-white',
          ].join(' ')}
        >
          <div className="text-xl font-semibold">{t.limit.title}</div>
          <div className="mt-2 text-sm text-white/90">{t.limit.description}</div>
          <div className="mt-6 flex gap-3">
            <Button
              variant="secondary"
              className="flex-1 bg-white/15 text-white hover:bg-white/20"
              onClick={onUpgrade}
            >
              {t.limit.subscription}
            </Button>
            <Button
              variant="ghost"
              className="flex-1 bg-transparent text-white/90 hover:text-white"
              onClick={onClose}
            >
              {t.limit.later}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
