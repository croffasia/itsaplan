import { Elysia, t } from 'elysia';
import { randomUUID } from 'node:crypto';
import { db, user } from '@repo/db';
import { eq } from 'drizzle-orm';
import { noContent } from '../shared/http';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { putObject, getObject, deleteObject } from '../shared/s3';
import { ErrorResponse } from '../shared/responses';
import { getStorageSettings, MB } from '../settings/storage';

// Avatar images for the signed-in user. The bytes live in the S3-compatible
// object store (../shared/s3.ts) under `avatars/<uuid>`; the user's `image`
// column (managed by better-auth) holds the relative serve URL. Only image
// types are accepted, so the public raw route can render them inline safely.
// The size limit is an instance setting (see ../settings/storage.ts), read per
// request so a change in god mode takes effect without a restart.

// Raster image types only. SVG is excluded on purpose: it can carry script and
// the raw route is public and same-origin, so an inline SVG would be stored XSS.
const ALLOWED_TYPES = /^image\/(png|jpe?g|gif|webp|avif)$/i;

// The relative URL stored in user.image for one of our avatars. The frontend
// prefixes it with the API origin when rendering.
const avatarUrl = (id: string) => `/avatars/${id}/raw`;

// The object key for an avatar id (the uuid used in its URL).
const avatarKey = (id: string) => `avatars/${id}`;

// Pulls the avatar id out of a stored user.image URL, or null if it is not one
// of our avatars (an external/OAuth image or empty). Used to delete the previous
// object when the avatar is replaced or removed.
function avatarIdFromImage(image: string | null | undefined): string | null {
  if (!image) return null;
  const match = image.match(/\/avatars\/([^/]+)\/raw$/);
  return match ? match[1] : null;
}

async function deletePreviousAvatar(image: string | null | undefined): Promise<void> {
  const id = avatarIdFromImage(image);
  if (!id) return;
  await deleteObject(avatarKey(id)).catch((err) => {
    console.error(
      `[planner] failed to delete previous avatar ${id}:`,
      err instanceof Error ? err.message : err,
    );
  });
}

export const avatarRoutes = new Elysia({ name: 'avatars', detail: { tags: ['Avatars'] } })
  .use(authContext)

  // Accepts a multipart form with a single "file" image field, stores the bytes,
  // sets the user's image to the new serve URL, and removes the previous avatar
  // object. Returns the new image URL.
  .post(
    '/me/avatar',
    async ({ user: sessionUser, body }) => {
      const current = requireUser(sessionUser);
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');
      const { maxAvatarMb } = await getStorageSettings();
      if (file.size > maxAvatarMb * MB) {
        throw new HttpError(413, `Image exceeds the ${maxAvatarMb} MB limit`);
      }
      const contentType = file.type || '';
      if (!ALLOWED_TYPES.test(contentType)) {
        throw new HttpError(400, 'Avatar must be a PNG, JPEG, GIF, WebP, or AVIF image');
      }

      const id = randomUUID();
      const bytes = Buffer.from(await file.arrayBuffer());
      try {
        await putObject(avatarKey(id), bytes, contentType);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[planner] avatar PUT failed (key=${avatarKey(id)}, size=${file.size}):`,
          err,
        );
        throw new HttpError(502, `Object store error: ${msg}`);
      }

      const url = avatarUrl(id);
      // Point the account at the new object first, then drop the old one (the
      // session user still carries the previous image); a failed cleanup only
      // orphans bytes.
      await db.update(user).set({ image: url }).where(eq(user.id, current.id));
      await deletePreviousAvatar(sessionUser?.image);

      return { image: url };
    },
    {
      body: t.Object({ file: t.File() }),
      response: {
        200: t.Object({ image: t.String() }),
        400: ErrorResponse,
        401: ErrorResponse,
        413: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: "Upload the current user's avatar" },
    },
  )

  // Clears the user's avatar and removes the stored object.
  .delete(
    '/me/avatar',
    async ({ user: sessionUser }) => {
      const current = requireUser(sessionUser);
      await db.update(user).set({ image: null }).where(eq(user.id, current.id));
      await deletePreviousAvatar(sessionUser?.image);
      return noContent();
    },
    {
      response: {
        204: t.Void(),
        401: ErrorResponse,
      },
      detail: { summary: "Remove the current user's avatar" },
    },
  )

  // Public preview URL: unauthenticated so it works in an <img> tag. The id is an
  // unguessable uuid. Only raster image types are stored, and nosniff plus the
  // media allowlist keep the bytes from being interpreted as anything executable.
  .get(
    '/avatars/:id/raw',
    async ({ params }) => {
      let obj;
      try {
        obj = await getObject(avatarKey(params.id));
      } catch (err) {
        throw new HttpError(404, err instanceof Error ? err.message : 'Object not found');
      }
      const ct = /^image\//i.test(obj.contentType) ? obj.contentType : 'application/octet-stream';
      const headers: Record<string, string> = {
        'Content-Type': ct,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
      };
      if (obj.contentLength != null) headers['Content-Length'] = String(obj.contentLength);
      return new Response(obj.body, { headers });
    },
    {
      params: t.Object({ id: t.String() }),
      // Public route: no 401/403. Returns raw bytes, so no typed 200 body.
      response: { 404: ErrorResponse },
      detail: { summary: "Preview a user's avatar (public, no auth)" },
    },
  );
