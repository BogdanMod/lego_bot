export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_GIT_SHA ?? null;
  const port = process.env.PORT ?? null;
  
  return Response.json({ 
    ok: true, 
    service: 'owner-web',
    gitSha,
    port,
    debugEnvPath: '/api/debug/env',
    ts: Date.now() 
  });
}

