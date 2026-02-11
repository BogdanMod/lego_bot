'use client';

import { ownerAuthTelegram } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.onTelegramAuth = async (payload: Record<string, unknown>) => {
      try {
        await ownerAuthTelegram(payload);
        router.push('/cabinet');
      } catch (e: any) {
        setError(e?.message || 'Ошибка входа');
      }
    };
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    containerRef.current?.appendChild(script);

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="panel w-full max-w-xl p-8">
        <h1 className="text-2xl font-semibold">Owner Cabinet</h1>
        <p className="muted mt-2">Вход без пароля через Telegram</p>
        <div ref={containerRef} className="mt-6" />
        <div className="mt-4 rounded-lg border border-border p-3 text-sm muted">
          Альтернативный вход: откройте Telegram-бота и отправьте команду <b>/cabinet</b>.
        </div>
        {error ? <div className="mt-4 text-sm text-red-500">{error}</div> : null}
      </div>
    </main>
  );
}

