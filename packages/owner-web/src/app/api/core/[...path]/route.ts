import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function buildTargetUrl(req: NextRequest, pathParts: string[]): string {
  const origin = process.env.CORE_API_ORIGIN?.trim();
  if (!origin) {
    throw new Error('CORE_API_ORIGIN is not configured');
  }
  const cleanOrigin = origin.replace(/\/+$/, '');
  const targetPath = pathParts.join('/');
  const query = req.nextUrl.search || '';
  return `${cleanOrigin}/api/${targetPath}${query}`;
}

function forwardRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'host') return;
    if (lower === 'content-length') return;
    headers.set(key, value);
  });
  headers.set('x-forwarded-host', req.headers.get('host') || req.nextUrl.host);
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));
  return headers;
}

function copyResponseHeaders(upstream: Response, upstreamUrl: string): Headers {
  const headers = new Headers();
  
  // Forward all headers except hop-by-hop
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'content-encoding') return;
    // Don't skip set-cookie here, we'll handle it separately
    if (lower === 'set-cookie') return;
    headers.append(key, value);
  });
  
  // Forward ALL Set-Cookie headers (safe, never throws)
  const getSetCookie = (upstream.headers as any).getSetCookie;
  const setCookies: string[] =
    typeof getSetCookie === 'function' ? getSetCookie.call(upstream.headers) : [];
  
  // If no cookies from getSetCookie, try single header
  if (setCookies.length === 0) {
    const single = upstream.headers.get('set-cookie');
    if (single) {
      setCookies.push(single);
    }
  }
  
  // Append each cookie
  for (const cookie of setCookies) {
    headers.append('set-cookie', cookie);
  }
  
  // Add debug header
  headers.set('x-proxy-upstream', upstreamUrl);
  
  return headers;
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.NEXT_PUBLIC_GIT_SHA ?? null;
  const method = req.method;
  const incomingPath = `/api/core/${pathParts.join('/')}`;
  
  try {
    // Explicit CORE_API_ORIGIN validation at the very top
    if (!process.env.CORE_API_ORIGIN) {
      console.error('[Proxy] CORE_API_ORIGIN is not set');
      return NextResponse.json(
        { ok: false, code: 'proxy_misconfigured', message: 'CORE_API_ORIGIN is not set' },
        { status: 500 }
      );
    }

    let targetUrl: string;
    try {
      targetUrl = buildTargetUrl(req, pathParts);
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, code: 'proxy_misconfigured', message: error?.message || 'Proxy misconfigured' },
        { status: 500 }
      );
    }
    
    // Log proxy request (without sensitive headers)
    console.log(JSON.stringify({
      action: 'proxy_request',
      method,
      incomingPath,
      targetUrl,
      gitSha,
      timestamp: new Date().toISOString(),
    }));

    const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
    // Longer timeout for LLM/generate-schema and bot creation (path: owner/bots, owner/bots/generate-schema)
    const isLongOperation =
      req.method.toUpperCase() === 'POST' &&
      (incomingPath.includes('/owner/bots/generate-schema') || (incomingPath === '/api/core/owner/bots' && hasBody));
    const proxyTimeoutMs = isLongOperation ? 60000 : 3000;

    let upstream: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), proxyTimeoutMs);

      try {
        upstream = await fetch(targetUrl, {
          method: req.method,
          headers: forwardRequestHeaders(req),
          body: hasBody ? req.body : undefined,
          redirect: 'manual',
          signal: controller.signal,
          // @ts-expect-error Next runtime supports duplex in node; harmless in edge runtime.
          duplex: hasBody ? 'half' : undefined,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError?.name === 'AbortError') {
          return NextResponse.json(
            { ok: false, code: 'proxy_timeout', message: `Upstream request timeout (${proxyTimeoutMs}ms)` },
            { status: 504 }
          );
        }
        throw fetchError;
      }
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, code: 'proxy_fetch_failed', message: String(error) },
        { status: 502 }
      );
    }

    // Get upstream body as stream/text
    const upstreamBody = upstream.body;
    if (!upstreamBody) {
      return NextResponse.json(
        { ok: false, code: 'proxy_empty_response', message: 'Upstream returned empty body' },
        { status: 502 }
      );
    }

    // Forward content-type if present
    const contentType = upstream.headers.get('content-type');
    const responseHeaders = copyResponseHeaders(upstream, targetUrl);
    if (contentType) {
      responseHeaders.set('content-type', contentType);
    }

    return new NextResponse(upstreamBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    // Top-level catch for ANY error in proxy()
    return NextResponse.json(
      { ok: false, code: 'proxy_internal_error', message: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxy(request, path);
}

