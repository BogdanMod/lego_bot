import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Debug endpoint to check environment variables
 * Returns boolean/length info, never exposes secrets
 */
export async function GET() {
  const enableOwnerWizard = process.env.ENABLE_OWNER_WIZARD;
  const coreApiOrigin = process.env.CORE_API_ORIGIN;
  const gitSha = process.env.GIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? null;
  
  return NextResponse.json({
    ok: true,
    service: 'owner-web',
    gitSha,
    ENABLE_OWNER_WIZARD: {
      set: Boolean(enableOwnerWizard),
      value: enableOwnerWizard || null,
      enabled: enableOwnerWizard === '1',
    },
    CORE_API_ORIGIN: {
      set: Boolean(coreApiOrigin?.trim()),
      startsWith: coreApiOrigin?.substring(0, 20) || null,
    },
    timestamp: Date.now(),
  });
}

