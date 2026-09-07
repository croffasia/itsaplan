import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import JSZip from 'jszip';

export type DocumentExportFormat = 'markdown' | 'html';

export interface PortableDocumentExportInput {
  title: string;
  content: string;
  richHtml?: string;
  format: DocumentExportFormat;
  projectKey: string;
  documentId: number;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface PortableDocumentExport {
  blob: Blob;
  filename: string;
}

export const MAX_DOCUMENT_EXPORT_ASSETS = 50;
export const MAX_DOCUMENT_EXPORT_BYTES = 100 * 1024 * 1024;
const DOCUMENT_EXPORT_FETCH_CONCURRENCY = 4;
const SAFE_INLINE_IMAGE_CONTENT_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export class DocumentExportLimitError extends Error {
  constructor() {
    super('The document export exceeds the protected asset limit.');
    this.name = 'DocumentExportLimitError';
  }
}

interface ExportAsset {
  references: string[];
  bytes: Uint8Array;
  contentType: string;
  filename: string;
}

const PUBLIC_ID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

function renderExportMarkdown(value: string): string {
  const html = marked.parse(value, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function documentExportFilename(title: string, extension: DocumentExportFormat): string {
  const base = title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'untitled'}.${extension === 'markdown' ? 'md' : 'html'}`;
}

export function documentExportBody(
  title: string,
  content: string,
  format: DocumentExportFormat,
  richHtml?: string,
): string {
  if (format === 'markdown') {
    return `${title.trim() ? `# ${title.trim()}\n\n` : ''}${content}`;
  }

  const heading = title.trim() ? `<h1>${escapeHtml(title.trim())}</h1>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title.trim() || 'Untitled')}</title>
  <style>body{max-width:760px;margin:64px auto;padding:0 24px;color:#171717;font:16px/1.65 system-ui,sans-serif}h1,h2,h3{line-height:1.2}pre{overflow:auto;padding:16px;background:#f5f5f5;border-radius:8px}code{font-family:ui-monospace,monospace}img{max-width:100%}blockquote{margin-inline:0;padding-inline-start:16px;border-inline-start:3px solid #d4d4d4;color:#525252}</style>
</head>
<body>${heading}${richHtml ? DOMPurify.sanitize(richHtml) : renderExportMarkdown(content)}</body>
</html>`;
}

export async function createPortableDocumentExport({
  title,
  content,
  richHtml,
  format,
  projectKey,
  documentId,
  baseUrl,
  fetchImpl = fetch,
}: PortableDocumentExportInput): Promise<PortableDocumentExport> {
  const body = documentExportBody(title, content, format, richHtml);
  const assets = await fetchDocumentExportAssets({
    body,
    projectKey,
    documentId,
    baseUrl,
    fetchImpl,
  });

  if (format === 'html') {
    const replacements = new Map<string, string>();
    for (const asset of assets) {
      const inlineContentType = SAFE_INLINE_IMAGE_CONTENT_TYPES.has(asset.contentType)
        ? asset.contentType
        : 'application/octet-stream';
      const dataUrl = `data:${inlineContentType};base64,${bytesToBase64(asset.bytes)}`;
      for (const reference of asset.references) replacements.set(reference, dataUrl);
    }
    return {
      blob: new Blob([replaceExportReferences(body, replacements)], {
        type: 'text/html;charset=utf-8',
      }),
      filename: documentExportFilename(title, 'html'),
    };
  }

  if (assets.length === 0) {
    return {
      blob: new Blob([body], { type: 'text/markdown;charset=utf-8' }),
      filename: documentExportFilename(title, 'markdown'),
    };
  }

  const zip = new JSZip();
  const replacements = new Map<string, string>();
  for (const asset of assets) {
    const assetPath = `assets/${asset.filename}`;
    zip.file(assetPath, asset.bytes);
    for (const reference of asset.references) replacements.set(reference, assetPath);
  }
  zip.file(documentExportFilename(title, 'markdown'), replaceExportReferences(body, replacements));
  return {
    blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }),
    filename: documentExportArchiveFilename(title),
  };
}

export function documentExportArchiveFilename(title: string): string {
  return documentExportFilename(title, 'markdown').replace(/\.md$/, '.zip');
}

async function fetchDocumentExportAssets({
  body,
  projectKey,
  documentId,
  baseUrl,
  fetchImpl,
}: {
  body: string;
  projectKey: string;
  documentId: number;
  baseUrl: string;
  fetchImpl: typeof fetch;
}): Promise<ExportAsset[]> {
  const base = new URL(baseUrl);
  const referencesByUrl = new Map<string, { url: URL; references: Set<string> }>();
  for (const reference of extractExportReferences(body)) {
    const url = protectedDocumentAssetUrl(reference, { projectKey, documentId, base });
    if (!url) continue;
    const existing = referencesByUrl.get(url.href);
    if (existing) existing.references.add(reference);
    else referencesByUrl.set(url.href, { url, references: new Set([reference]) });
  }

  if (referencesByUrl.size > MAX_DOCUMENT_EXPORT_ASSETS) {
    throw new DocumentExportLimitError();
  }

  const usedFilenames = new Set<string>();
  const entries = [...referencesByUrl.values()];
  const results = new Array<ExportAsset>(entries.length);
  const controller = new AbortController();
  const byteBudget = new ExportByteBudget(MAX_DOCUMENT_EXPORT_BYTES);
  let cursor = 0;
  let primaryError: unknown;

  const worker = async () => {
    while (cursor < entries.length && !controller.signal.aborted) {
      const index = cursor++;
      const entry = entries[index];
      if (!entry) return;
      try {
        const response = await fetchImpl(entry.url.href, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Unable to export document asset (${response.status})`);
        }
        const contentType = safeContentType(response.headers.get('content-type'));
        const publicId = entry.url.pathname.match(
          new RegExp(`/assets/(${PUBLIC_ID})/raw$`, 'i'),
        )?.[1];
        const preferredFilename = contentDispositionFilename(
          response.headers.get('content-disposition'),
        );
        const filename = uniqueAssetFilename(
          preferredFilename || `${publicId ?? 'asset'}${extensionForContentType(contentType)}`,
          usedFilenames,
        );
        results[index] = {
          references: [...entry.references],
          bytes: await readExportAssetBytes(response, byteBudget),
          contentType,
          filename,
        };
      } catch (error) {
        if (primaryError === undefined) {
          primaryError = error;
          controller.abort();
        }
        throw primaryError;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(DOCUMENT_EXPORT_FETCH_CONCURRENCY, entries.length) }, worker),
  );
  return results;
}

class ExportByteBudget {
  private actualBytes = 0;
  private reservedBytes = 0;

  constructor(private readonly limit: number) {}

  reserve(declaredBytes: number | null) {
    let remaining = declaredBytes ?? 0;
    if (this.actualBytes + this.reservedBytes + remaining > this.limit) {
      throw new DocumentExportLimitError();
    }
    this.reservedBytes += remaining;
    let released = false;
    return {
      record: (bytes: number) => {
        const covered = Math.min(bytes, remaining);
        remaining -= covered;
        this.reservedBytes -= covered;
        this.actualBytes += bytes;
        if (this.actualBytes + this.reservedBytes > this.limit) {
          throw new DocumentExportLimitError();
        }
      },
      release: () => {
        if (released) return;
        released = true;
        this.reservedBytes -= remaining;
        remaining = 0;
      },
    };
  }
}

async function readExportAssetBytes(
  response: Response,
  byteBudget: ExportByteBudget,
): Promise<Uint8Array> {
  const reservation = byteBudget.reserve(contentLength(response.headers.get('content-length')));
  try {
    if (!response.body) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      reservation.record(bytes.byteLength);
      return bytes;
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      reservation.record(value.byteLength);
      chunks.push(value);
      length += value.byteLength;
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    reservation.release();
  }
}

function contentLength(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function extractExportReferences(body: string): Set<string> {
  const references = new Set<string>();
  for (const match of body.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    if (match[1]) references.add(match[1]);
  }
  for (const match of body.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g)) {
    const value = match[1] ?? match[2];
    if (value) references.add(value);
  }
  return references;
}

function protectedDocumentAssetUrl(
  reference: string,
  { projectKey, documentId, base }: { projectKey: string; documentId: number; base: URL },
): URL | null {
  let url: URL;
  try {
    url = new URL(reference, base);
  } catch {
    return null;
  }
  if (url.origin !== base.origin || url.search || url.hash) return null;
  const expected = new RegExp(
    `^/protected-media/projects/${escapeRegExp(encodeURIComponent(projectKey))}/documents/${documentId}/assets/${PUBLIC_ID}/raw$`,
    'i',
  );
  return expected.test(url.pathname) ? url : null;
}

function replaceExportReferences(body: string, replacements: Map<string, string>): string {
  const htmlRewritten = body.replace(
    /\b(src|href)(\s*=\s*)(["'])([^"']+)\3/gi,
    (match, attribute: string, separator: string, quote: string, reference: string) => {
      const replacement = replacements.get(reference);
      return replacement ? `${attribute}${separator}${quote}${replacement}${quote}` : match;
    },
  );
  return htmlRewritten.replace(
    /(!?\[[^\]]*\]\(\s*)(?:<([^>]+)>|([^\s)]+))(?=[\s)])/g,
    (
      match,
      prefix: string,
      wrappedReference: string | undefined,
      reference: string | undefined,
    ) => {
      const replacement = replacements.get(wrappedReference ?? reference ?? '');
      return replacement ? `${prefix}${replacement}` : match;
    },
  );
}

function safeContentType(value: string | null): string {
  const contentType = value?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(contentType)
    ? contentType
    : 'application/octet-stream';
}

function contentDispositionFilename(value: string | null): string | null {
  if (!value) return null;
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = value.match(/filename="?([^";]+)"?/i)?.[1];
  const candidate = encoded ? safeDecodeURIComponent(encoded) : plain;
  return candidate ? sanitizeAssetFilename(candidate) : null;
}

function sanitizeAssetFilename(value: string): string {
  const basename = value.replaceAll('\\', '/').split('/').pop() ?? '';
  const sanitized = basename
    .normalize('NFKC')
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return sanitized && sanitized !== '.' && sanitized !== '..' ? sanitized : 'asset';
}

function uniqueAssetFilename(value: string, used: Set<string>): string {
  const safe = sanitizeAssetFilename(value);
  const dot = safe.lastIndexOf('.');
  const base = dot > 0 ? safe.slice(0, dot) : safe;
  const extension = dot > 0 ? safe.slice(dot) : '';
  let candidate = safe;
  let suffix = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${base}-${suffix++}${extension}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

function extensionForContentType(contentType: string): string {
  return (
    {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'application/pdf': '.pdf',
    }[contentType] ?? ''
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
