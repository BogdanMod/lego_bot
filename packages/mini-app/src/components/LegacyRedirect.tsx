'use client';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { openOwnerWebCabinet } from '../utils/ownerWeb';
import { toast } from 'sonner';

interface LegacyRedirectProps {
  message?: string;
  targetPath?: string;
}

export function LegacyRedirect({ message, targetPath = '/subscription' }: LegacyRedirectProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Show toast notification
    toast.info('Управление ботами переехало в Owner Web', {
      description: 'Используйте Owner Web для создания и редактирования ботов.',
      duration: 5000,
    });

    // Redirect after a short delay
    const timer = setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate, targetPath]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-lg border border-amber-200 dark:border-amber-800 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Управление ботами переехало в Owner Web
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              {message || 'Создание, редактирование и настройки ботов теперь доступны в Owner Web.'}
            </p>
            <div className="space-y-2">
              <button
                onClick={() => openOwnerWebCabinet()}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Открыть Owner Web
              </button>
              <button
                onClick={() => navigate('/subscription', { replace: true })}
                className="w-full px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Вернуться в Mini App
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

