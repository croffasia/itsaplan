import { db, user } from '@repo/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { HttpError } from '#shared/lib';
import { putObject, getObject, deleteObject } from '#shared/s3';
import { getStorageSettings, MB } from '#modules/settings/service';

// Avatar images for the signed-in user. The bytes live in the S3-compatible
// object store under `avatars/<uuid>`; the user's `image` column (managed by
// better-auth) holds the relative serve URL.

// Raster image types only. SVG is excluded on purpose: it can carry script and
// the raw route is public and same-origin, so an inline SVG would be stored XSS.
const ALLOWED_TYPES = /^image\/(png|jpe?g|gif|webp|avif)$/i;

// The relative URL stored in user.image for one of our avatars. The frontend
// prefixes it with the API origin when rendering.
const avatarUrl = (id: string) => `/avatars/${id}/raw`;

const avatarKey = (id: string) => `avatars/${id}`;

// Pulls the avatar id out of a stored user.image URL, or null if it is not one
// of our avatars (an external/OAuth image or empty). Used to delete the previous
// object when the avatar is replaced or removed.
function avatarIdFromImage(image: string | null | undefined): string | null {
  if (!image) return null;
  const match = image.match(/\/avatars\/([^/]+)\/raw$/);
  return match ? match[1] : null;
}

async function setUserImage(userId: string, image: string | null): Promise<void> {
  await db.update(user).set({ image }).where(eq(user.id, userId));
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

// The size limit is an instance setting (see modules/settings/service.ts), read per
// call so a change in god mode takes effect without a restart.
export async function replaceAvatar(
  userId: string,
  currentImage: string | null | undefined,
  file: unknown,
): Promise<string> {
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
  const key = avatarKey(id);
  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), contentType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[planner] avatar PUT failed (key=${key}, size=${file.size}):`, err);
    throw new HttpError(502, `Object store error: ${msg}`);
  }

  const url = avatarUrl(id);
  // Point the account at the new object first, then drop the old one (the session
  // user still carries the previous image); a failed cleanup only orphans bytes.
  await setUserImage(userId, url);
  await deletePreviousAvatar(currentImage);
  return url;
}

export async function clearAvatar(
  userId: string,
  currentImage: string | null | undefined,
): Promise<void> {
  await setUserImage(userId, null);
  await deletePreviousAvatar(currentImage);
}

export async function readAvatar(id: string) {
  try {
    return await getObject(avatarKey(id));
  } catch (err) {
    throw new HttpError(404, err instanceof Error ? err.message : 'Object not found');
  }
}
