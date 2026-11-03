import { db, projectTemplate, templatePublisher } from '@repo/db';
import { decryptSecret, encryptSecret } from '@repo/crypto';
import { eq } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { requireWorkspaceTemplate } from './service';
import { sharedTemplate } from './share';

// The gallery at itsaplan.dev that a workspace publishes its project templates to. A
// workspace links to it once, with a code the gallery emails to the address it names;
// after that every manager of the workspace publishes with the key the link stored. The
// gallery keeps one author per address and shows it on every template from it; the
// workspace keeps a copy to show in its dialogs.
// Fixed, like the telemetry endpoint: every instance publishes to the one gallery.
const GALLERY_URL = 'https://templates.itsaplan.dev';
const TIMEOUT_MS = 10_000;

export interface TemplatePublisher {
  email: string;
  authorName: string;
  authorUrl: string | null;
}

export interface TemplatePublication {
  url: string;
  publishedAt: string;
}

class GalleryRefusal extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function gallery<T>(
  method: string,
  path: string,
  options: { body?: unknown; key?: string } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${GALLERY_URL}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.key && { authorization: `Bearer ${options.key}` }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'The template gallery did not answer. Try again later.');
  }
  if (response.ok) {
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
  const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const message =
    typeof body?.error === 'string' ? body.error : 'The template gallery refused the request';
  throw new GalleryRefusal(response.status, message);
}

// What the gallery refused, as this api answers it: a wrong code, a blocked address or
// too many tries are the caller's to fix; a key it no longer takes means linking again;
// anything else is the gallery's failure.
function answer(refusal: unknown): never {
  if (!(refusal instanceof GalleryRefusal)) throw refusal;
  switch (refusal.status) {
    case 400:
    case 403:
    case 429:
      throw new HttpError(refusal.status, refusal.message);
    case 413:
      throw new HttpError(413, 'The template is too large for the gallery');
    case 401:
      throw new HttpError(
        409,
        'The gallery no longer accepts the key of this workspace. Link the workspace again.',
      );
    default:
      throw new HttpError(502, `The template gallery failed: ${refusal.message}`);
  }
}

async function readPublisher(workspaceId: number) {
  const [row] = await db
    .select()
    .from(templatePublisher)
    .where(eq(templatePublisher.workspaceId, workspaceId));
  return row ?? null;
}

function publisherKey(row: typeof templatePublisher.$inferSelect): string {
  return decryptSecret({ ciphertext: row.keyCiphertext, iv: row.keyIv, authTag: row.keyAuthTag });
}

function publisherDto(row: typeof templatePublisher.$inferSelect): TemplatePublisher {
  return { email: row.email, authorName: row.authorName, authorUrl: row.authorUrl };
}

export async function getTemplatePublisher(workspaceId: number): Promise<TemplatePublisher | null> {
  const row = await readPublisher(workspaceId);
  return row && publisherDto(row);
}

export async function requestPublisherCode(email: string): Promise<void> {
  await gallery<void>('POST', '/v1/publishers/code', { body: { email } }).catch(answer);
}

type GalleryAuthor = { name: string; url: string | null };

// Links the workspace to the gallery publisher of the address the code confirms. A
// workspace already linked moves to the new address.
export async function linkTemplatePublisher(
  workspaceId: number,
  input: { email: string; code: string },
): Promise<TemplatePublisher> {
  const { key, author } = await gallery<{ key: string; author: GalleryAuthor }>(
    'POST',
    '/v1/publishers/verify',
    { body: input },
  ).catch(answer);
  const enc = encryptSecret(key);
  const values = {
    email: input.email.trim().toLowerCase(),
    keyCiphertext: enc.ciphertext,
    keyIv: enc.iv,
    keyAuthTag: enc.authTag,
    authorName: author.name,
    authorUrl: author.url,
  };
  const [row] = await db
    .insert(templatePublisher)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({ target: templatePublisher.workspaceId, set: values })
    .returning();
  return publisherDto(row);
}

// Forgets the link. The templates it published stay in the gallery; linking the same
// address again manages them.
export async function unlinkTemplatePublisher(workspaceId: number): Promise<void> {
  await db.delete(templatePublisher).where(eq(templatePublisher.workspaceId, workspaceId));
}

async function requireKey(workspaceId: number) {
  const publisher = await readPublisher(workspaceId);
  if (!publisher) throw new HttpError(409, 'Link the workspace to the template gallery first');
  return { publisher, key: publisherKey(publisher) };
}

// Sets the author every template of the linked address shows in the gallery.
export async function setTemplatePublisherAuthor(
  workspaceId: number,
  input: { authorName: string; authorUrl?: string | null },
): Promise<TemplatePublisher> {
  const { key } = await requireKey(workspaceId);
  const url = input.authorUrl?.trim();
  const { author } = await gallery<{ author: GalleryAuthor }>('PUT', '/v1/publishers/me', {
    body: { name: input.authorName.trim(), ...(url && { url }) },
    key,
  }).catch(answer);
  const [row] = await db
    .update(templatePublisher)
    .set({ authorName: author.name, authorUrl: author.url })
    .where(eq(templatePublisher.workspaceId, workspaceId))
    .returning();
  if (!row) throw new HttpError(409, 'Link the workspace to the template gallery first');
  return publisherDto(row);
}

// Publishes the template as an export holds it, or updates the page it already has.
// A page the gallery no longer holds is published again under a new address.
export async function publishTemplate(
  workspaceId: number,
  templateId: number,
): Promise<TemplatePublication> {
  const row = await requireWorkspaceTemplate(workspaceId, templateId);
  const { publisher, key } = await requireKey(workspaceId);
  if (!publisher.authorName) {
    throw new HttpError(409, 'Name the author of the gallery address first');
  }
  const body = { template: sharedTemplate(row) };
  type Published = { id: string; url: string };
  const update = row.publicationId
    ? await gallery<Published>('PUT', `/v1/templates/${row.publicationId}`, { body, key }).catch(
        (refusal: unknown) => {
          if (refusal instanceof GalleryRefusal && refusal.status === 404) return null;
          return answer(refusal);
        },
      )
    : null;
  const published =
    update ?? (await gallery<Published>('POST', '/v1/templates', { body, key }).catch(answer));
  const publishedAt = new Date();
  await db
    .update(projectTemplate)
    .set({ publicationId: published.id, publicationUrl: published.url, publishedAt })
    .where(eq(projectTemplate.id, templateId));
  return { url: published.url, publishedAt: iso(publishedAt) };
}

// Takes the template's page down. A page the gallery no longer holds counts as taken down.
export async function unpublishTemplate(workspaceId: number, templateId: number): Promise<void> {
  const row = await requireWorkspaceTemplate(workspaceId, templateId);
  if (!row.publicationId) return;
  const { key } = await requireKey(workspaceId);
  await gallery<void>('DELETE', `/v1/templates/${row.publicationId}`, { key }).catch(
    (refusal: unknown) => {
      if (refusal instanceof GalleryRefusal && refusal.status === 404) return;
      answer(refusal);
    },
  );
  await db
    .update(projectTemplate)
    .set({ publicationId: null, publicationUrl: null, publishedAt: null })
    .where(eq(projectTemplate.id, templateId));
}
