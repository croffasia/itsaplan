import {
  db,
  getStorageSettings,
  gitManagedRepository,
  gitProviderConnection,
  issueAttachment,
  MB,
} from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { pinnedFetch } from '#shared/net';
import { createAttachment } from '#modules/attachments/service';
import {
  assertAttachmentUploadAllowed,
  attachmentObjectKey,
  deleteAttachmentObject,
  safeAttachmentFilename,
  storeAttachmentObject,
} from '#modules/attachments/storage';
import {
  providerFileId,
  providerFileRequests,
  providerSignedFiles,
  type ProviderConnectionInput,
  type ProviderFileRequest,
  type ProviderRepository,
} from './connections-provider';
import { providerCallArgs, providerCallColumns } from './connections-service';

// Files a synced repository issue or comment embeds are copied into the attachments of
// the issue here, and the text points at the copies: the host's addresses need a session
// there, or a token, on a private repository. A file that cannot be copied keeps its
// link. The copy remembers its address, so the same text synced again reuses it.

export interface FileSource {
  repositoryId: number;
  projectId: number;
  issueId: number;
  // Where the text is on the host: an issue by its number, or a comment by its id.
  where: { number: number } | { commentId: string };
}

// A markdown image or link, and an HTML image, the form GitHub writes for a resized one.
const EMBED =
  /(!?)\[((?:\\.|[^\]\\])*)\]\(\s*(<?)([^\s)>]+)(>?)((?:\s+(?:"[^"]*"|'[^']*'))?\s*)\)/g;
const IMG = /<img\b[^>]*>/gi;
const SRC = /\bsrc\s*=\s*(["'])(.*?)\1/i;
const ALT = /\balt\s*=\s*(["'])(.*?)\1/i;

const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 3;

// The address a text embeds an attachment by: the web app's media route, which the
// editor and the import write too.
const attachmentEmbedUrl = (publicId: string) => `/media/attachments/${publicId}/raw`;

// Every address the text embeds, with the label it is shown under.
function embeddedFiles(text: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const match of text.matchAll(EMBED)) {
    if (!files.has(match[4]!)) files.set(match[4]!, match[2]!.replace(/\\(.)/g, '$1'));
  }
  for (const [tag] of text.matchAll(IMG)) {
    const src = tag.match(SRC)?.[2];
    if (src && !files.has(src)) files.set(src, tag.match(ALT)?.[2] ?? '');
  }
  return files;
}

function rewriteLinks(text: string, copies: Map<string, string>): string {
  return text
    .replace(EMBED, (embed, bang, label, open, url, close, title) => {
      const copy = copies.get(url);
      return copy ? `${bang}[${label}](${open}${copy}${close}${title})` : embed;
    })
    .replace(IMG, (tag) => {
      const src = tag.match(SRC);
      const copy = src && copies.get(src[2]!);
      return copy ? tag.replace(src[0], `src=${src[1]}${copy}${src[1]}`) : tag;
    });
}

async function repositoryCall(repositoryId: number) {
  const [row] = await db
    .select(providerCallColumns)
    .from(gitManagedRepository)
    .innerJoin(
      gitProviderConnection,
      eq(gitManagedRepository.connectionId, gitProviderConnection.id),
    )
    .where(eq(gitManagedRepository.id, repositoryId))
    .limit(1);
  return row ? providerCallArgs(row) : null;
}

interface Downloaded {
  bytes: Buffer;
  contentType: string;
  // The address the bytes came from, after redirects.
  url: string;
}

// pinnedFetch follows no redirect, so each hop is taken here. The host's token goes only
// to the host itself, never to the storage it redirects to.
async function download(request: ProviderFileRequest, maxBytes: number): Promise<Downloaded> {
  let url = request.url;
  let headers = request.headers;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await pinnedFetch(url, { headers, timeoutMs: DOWNLOAD_TIMEOUT_MS, maxBytes });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, url);
      if (next.origin !== new URL(url).origin) headers = undefined;
      url = next.toString();
      continue;
    }
    if (!response.ok) throw new Error(`the download answered HTTP ${response.status}`);
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type')?.split(';')[0]?.trim() ?? '',
      url,
    };
  }
  throw new Error(`the download redirected more than ${MAX_REDIRECTS} times`);
}

async function downloadFirst(
  requests: ProviderFileRequest[],
  maxBytes: number,
): Promise<Downloaded> {
  let failure: unknown;
  for (const request of requests) {
    try {
      return await download(request, maxBytes);
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

const EXTENSION = /\.[a-z0-9]{1,8}$/i;

// The label the text shows the file under, with the extension of the address it came
// from when the label has none: GitHub names an image by its alt text.
function fileName(label: string, url: string): string {
  let last = '';
  try {
    last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
  } catch {
    // A malformed escape leaves the label without an extension.
  }
  const base = label.trim().slice(0, 100) || last || 'file';
  return safeAttachmentFilename(
    EXTENSION.test(base) ? base : `${base}${last.match(EXTENSION)?.[0] ?? ''}`,
  );
}

async function copyFile(
  url: string,
  label: string,
  call: { input: ProviderConnectionInput; repository: ProviderRepository },
  signed: () => Promise<Map<string, string>>,
  source: FileSource,
): Promise<string> {
  const [known] = await db
    .select({ publicId: issueAttachment.publicId })
    .from(issueAttachment)
    .where(and(eq(issueAttachment.issueId, source.issueId), eq(issueAttachment.sourceUrl, url)))
    .limit(1);
  if (known) return attachmentEmbedUrl(known.publicId);

  const requests = providerFileRequests(call.input, call.repository, url)!;
  const id = providerFileId(url);
  const signedUrl = id ? (await signed()).get(id) : undefined;
  const { maxAttachmentMb } = await getStorageSettings();
  const file = await downloadFirst(
    signedUrl ? [{ url: signedUrl }, ...requests] : requests,
    maxAttachmentMb * MB,
  );
  const filename = fileName(label, file.url);
  const contentType =
    file.contentType && file.contentType !== 'application/octet-stream'
      ? file.contentType
      : Bun.file(filename).type.split(';')[0]!;
  await assertAttachmentUploadAllowed(source.projectId, file.bytes.length, contentType);
  const key = attachmentObjectKey(source.projectId, 'attachments', source.issueId, filename);
  await storeAttachmentObject(key, file.bytes, contentType);
  try {
    const row = await createAttachment({
      projectId: source.projectId,
      issueId: source.issueId,
      s3Key: key,
      filename,
      contentType,
      sizeBytes: file.bytes.length,
      sourceUrl: url,
    });
    return attachmentEmbedUrl(row.publicId);
  } catch (error) {
    await deleteAttachmentObject(key);
    throw error;
  }
}

// The text with each file of the repository host it embeds copied here.
export async function copyRepositoryFiles(text: string, source: FileSource): Promise<string> {
  const files = embeddedFiles(text);
  if (files.size === 0) return text;
  const call = await repositoryCall(source.repositoryId);
  if (!call) return text;
  const hosted = [...files].filter(([url]) =>
    providerFileRequests(call.input, call.repository, url),
  );
  if (hosted.length === 0) return text;

  // Read once, and only when a file is not copied yet.
  let signed: Promise<Map<string, string>> | null = null;
  const signedFiles = () =>
    (signed ??= providerSignedFiles(call.input, call.repository, source.where).catch(
      () => new Map<string, string>(),
    ));
  const copies = new Map<string, string>();
  for (const [url, label] of hosted) {
    try {
      copies.set(url, await copyFile(url, label, call, signedFiles, source));
    } catch (error) {
      console.warn(
        `[git] kept the link to ${url}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return rewriteLinks(text, copies);
}
