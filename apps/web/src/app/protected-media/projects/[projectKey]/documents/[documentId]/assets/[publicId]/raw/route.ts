import { serverRuntimeEnv } from '@/utils/runtimeEnv';

// This route deliberately has a fixed shape. Unlike the public /media proxy it
// forwards the session cookie, so accepting an arbitrary upstream path here would
// turn the web application into an authenticated API proxy.
const DOCUMENT_ID = /^[1-9]\d*$/;
const PUBLIC_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PASSTHROUGH_HEADERS = [
  'content-type',
  'content-length',
  'content-disposition',
  'cache-control',
  'etag',
  'x-content-type-options',
  'content-security-policy',
];

type RouteParams = {
  projectKey: string;
  documentId: string;
  publicId: string;
};

export async function GET(request: Request, { params }: { params: Promise<RouteParams> }) {
  const { projectKey, documentId, publicId } = await params;
  if (!validProjectKey(projectKey) || !DOCUMENT_ID.test(documentId) || !PUBLIC_ID.test(publicId)) {
    return new Response(null, { status: 404 });
  }

  const cookie = request.headers.get('cookie');
  if (!cookie) return new Response(null, { status: 401 });

  const origin = process.env.SERVICE_URL_API || serverRuntimeEnv().apiUrl;
  const upstream = await fetch(
    `${origin}/projects/${encodeURIComponent(projectKey)}/documents/${documentId}/assets/${publicId}/raw`,
    {
      headers: forwardedHeaders(request, cookie),
      cache: 'no-store',
      redirect: 'error',
    },
  );

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

function validProjectKey(value: string): boolean {
  const hasUnsafeCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return character === '/' || codePoint <= 0x1f || codePoint === 0x7f;
  });
  return (
    value.length > 0 &&
    value.length <= 128 &&
    value !== '.' &&
    value !== '..' &&
    !hasUnsafeCharacter
  );
}

function forwardedHeaders(request: Request, cookie: string): HeadersInit {
  const headers: Record<string, string> = { cookie };
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) headers['if-none-match'] = ifNoneMatch;
  return headers;
}
