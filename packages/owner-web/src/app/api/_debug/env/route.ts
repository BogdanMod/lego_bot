import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check environment variables (dev/staging only)
 * Returns boolean/length info, never exposes secrets
 */
export async function GET() {
  // Only allow in non-production environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ ok: false, error: 'Not available in production' }, { status: 404 });
  }

  const enableOwnerWizard = process.env.ENABLE_OWNER_WIZARD;
  
  const env = {
    // Owner-web specific
    CORE_API_ORIGIN: {
      set: Boolean(process.env.CORE_API_ORIGIN?.trim()),
      length: process.env.CORE_API_ORIGIN?.length || 0,
      startsWith: process.env.CORE_API_ORIGIN?.substring(0, 10) || null,
    },
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: {
      set: Boolean(process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim()),
      length: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.length || 0,
    },
    ENABLE_OWNER_WIZARD: {
      set: Boolean(enableOwnerWizard),
      value: enableOwnerWizard || null,
      length: enableOwnerWizard?.length || 0,
      enabled: enableOwnerWizard === '1',
    },
    // Core API should have these (we don't have direct access, but we can check if proxy works)
    NODE_ENV: process.env.NODE_ENV || 'development',
    // Request context
    timestamp: Date.now(),
    service: 'owner-web',
  };

  return NextResponse.json({
    ok: true,
    env,
    gitSha: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_GIT_SHA ?? null,
    note: 'Secrets are never exposed. Only boolean/length info is shown.',
  });
}

