'use client';

import { ownerAuthBotlink, type ApiError } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

export const dynamic = 'force-dynamic';

function mapAuthError(error: unknown): string {
  const err = error as ApiError | undefined;
  if (!err?.code) return 'Не удалось выполнить вход. Попробуйте снова через /cabinet.';
  if (err.code === 'timeout' || err.code === 'proxy_timeout') {
    return 'Сервер долго не ответил. Откройте в Telegram новую ссылку (отправьте /cabinet ещё раз) или попробуйте через минуту.';
  }
  if (err.code === 'botlink_used') {
    return 'Эта ссылка уже использована. Откройте Telegram и снова отправьте /cabinet.';
  }
  if (err.code === 'botlink_expired') {
    return 'Срок действия ссылки истек. Откройте Telegram и снова отправьте /cabinet.';
  }
  if (err.code === 'no_bots_access') {
    return 'У вас нет доступа к кабинетам. Обратитесь к владельцу бота для выдачи прав.';
  }
  return err.message || 'Не удалось выполнить вход. Попробуйте снова через /cabinet.';
}

function BotAuthContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Ссылка входа некорректна. Вернитесь в Telegram и отправьте /cabinet.');
      setLoading(false);
      return;
    }

    // Get next path from query parameter
    const nextPath = searchParams.get('next');
    // Validate next path: must be relative, start with /, and not contain protocol
    const validNextPath = nextPath && nextPath.startsWith('/') && !nextPath.includes('://') && !nextPath.startsWith('//') 
      ? nextPath 
      : '/cabinet';

    let isCancelled = false;
    (async () => {
      try {
        const result = await ownerAuthBotlink(token, validNextPath);
        if (isCancelled) return;
        // Use redirect from response if available, otherwise use nextPath
        const redirectPath = result.redirect || validNextPath;
        router.replace(redirectPath);
      } catch (e) {
        if (isCancelled) return;
        setError(mapAuthError(e));
        setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [router, searchParams]);

  return (
    <>
      {loading ? <p className="muted mt-3">Проверяем ссылку входа...</p> : null}
      {error ? <div className="mt-4 text-sm text-red-500">{error}</div> : null}
      {!loading ? (
        <p className="muted mt-4 text-sm">
          Вернитесь в Telegram, отправьте команду <b>/cabinet</b> и откройте новую ссылку.
        </p>
      ) : null}
    </>
  );
}

export default function BotAuthPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="panel w-full max-w-xl p-8">
        <div className="text-xs font-semibold text-primary tracking-wider">Zer | Con</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">Zero Context System</div>
        <h1 className="text-xl font-semibold text-fg mt-4">Вход</h1>
        <Suspense fallback={<p className="muted mt-3">Загрузка...</p>}>
          <BotAuthContent />
        </Suspense>
      </div>
    </main>
  );
}

