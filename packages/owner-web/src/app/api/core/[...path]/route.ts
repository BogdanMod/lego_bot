import { NextRequest, NextResponse } from 'next/server';

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

function copyResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'content-encoding') return;
    if (lower === 'set-cookie') return;
    headers.append(key, value);
  });
  const getSetCookie = (upstream.headers as any).getSetCookie as (() => string[]) | undefined;
  if (typeof getSetCookie === 'function') {
    const all = getSetCookie();
    for (const cookie of all) {
      headers.append('set-cookie', cookie);
    }
  } else {
    const one = upstream.headers.get('set-cookie');
    if (one) headers.append('set-cookie', one);
  }
  return headers;
}

async function proxy(req: NextRequest, pathParts: string[]) {
  let targetUrl: string;
  try {
    targetUrl = buildTargetUrl(req, pathParts);
  } catch (error: any) {
    return NextResponse.json(
      { code: 'misconfigured', message: error?.message || 'Proxy misconfigured' },
      { status: 500 }
    );
  }

  const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers: forwardRequestHeaders(req),
    body: hasBody ? req.body : undefined,
    redirect: 'manual',
    // @ts-expect-error Next runtime supports duplex in node; harmless in edge runtime.
    duplex: hasBody ? 'half' : undefined,
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: copyResponseHeaders(upstream),
  });
}

export async function GET(
  request: Request,
  context: { params: { path: string[] } }
) {
  const { path } = context.params;
  return proxy(request as NextRequest, path);
}

export async function POST(
  request: Request,
  context: { params: { path: string[] } }
) {
  const { path } = context.params;
  return proxy(request as NextRequest, path);
}

export async function PATCH(
  request: Request,
  context: { params: { path: string[] } }
) {
  const { path } = context.params;
  return proxy(request as NextRequest, path);
}

export async function DELETE(
  request: Request,
  context: { params: { path: string[] } }
) {
  const { path } = context.params;
  return proxy(request as NextRequest, path);
}

export async function PUT(
  request: Request,
  context: { params: { path: string[] } }
) {
  const { path } = context.params;
  return proxy(request as NextRequest, path);
}

export async function OPTIONS(
  request: Request,
  context: { params: { path: string[] } }
) {
  const { path } = context.params;
  return proxy(request as NextRequest, path);
}

