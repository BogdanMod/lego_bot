'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ownerFetch, type ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { Bot, ExternalLink, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface BotPublishProps {
  botId: string;
  botName: string;
  hasToken: boolean;
}

export function BotPublish({ botId, botName, hasToken }: BotPublishProps) {
  const [token, setToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const updateTokenMutation = useMutation({
    mutationFn: async (newToken: string) => {
      // Validate token format
      if (!/^\d+:[A-Za-z0-9_-]+$/.test(newToken.trim())) {
        throw new Error('Неверный формат токена. Ожидается формат: <bot_id>:<token>');
      }

      return ownerFetch<{ ok: boolean; message?: string }>(`/api/owner/bots/${botId}/token`, {
        method: 'PUT',
        body: { token: newToken.trim() },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bot', botId] });
      toast.success('Токен бота успешно обновлен');
      setToken('');
    },
    onError: (error: ApiError) => {
      toast.error(error?.message || 'Ошибка при обновлении токена');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Введите токен бота');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateTokenMutation.mutateAsync(token);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
          <Bot className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold mb-1">Публикация бота</h2>
          <p className="text-sm text-muted-foreground">
            Добавьте токен бота из BotFather, чтобы активировать бота
          </p>
        </div>
        {hasToken && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>Токен установлен</span>
          </div>
        )}
      </div>

      {!hasToken && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
                Бот не опубликован
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Добавьте токен бота из BotFather, чтобы активировать бота и начать получать сообщения от пользователей.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-3">Как получить токен бота:</h3>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">1.</span>
              <span>
                Откройте{' '}
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  @BotFather
                  <ExternalLink className="w-3 h-3" />
                </a>{' '}
                в Telegram
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">2.</span>
              <span>Отправьте команду <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">/newbot</code></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">3.</span>
              <span>Следуйте инструкциям BotFather: придумайте имя и username для бота</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">4.</span>
              <span>
                После создания бота BotFather пришлет токен вида:{' '}
                <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono">
                  123456789:ABCdefGHIjklMNOpqrsTUVwxyz
                </code>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-slate-900 dark:text-slate-100">5.</span>
              <span>Скопируйте токен и вставьте в поле ниже</span>
            </li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="bot-token" className="block text-sm font-medium mb-1.5">
              Токен бота
            </label>
            <input
              id="bot-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
              disabled={isSubmitting}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              ⚠️ Никому не передавайте токен бота. Храните его в секрете.
            </p>
          </div>

          <button
            type="submit"
            disabled={!token.trim() || isSubmitting}
            className="w-full px-4 py-2.5 text-sm font-medium rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Сохранение...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{hasToken ? 'Обновить токен' : 'Опубликовать бота'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

