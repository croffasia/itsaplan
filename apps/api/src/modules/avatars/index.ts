import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { errors } from '#shared/responses';
import { AvatarResponse, avatarParams, uploadAvatarBody } from './model';
import { clearAvatar, readAvatar, replaceAvatar } from './service';

export const avatarRoutes = new Elysia({ name: 'avatars', detail: { tags: ['Avatars'] } })
  .use(authContext)

  .post(
    '/me/avatar',
    async ({ user: sessionUser, body }) => {
      const current = requireUser(sessionUser);
      const image = await replaceAvatar(current.id, sessionUser?.image, body.file);
      return { image };
    },
    {
      body: uploadAvatarBody,
      response: { 200: AvatarResponse, ...errors(400, 401, 413, 502) },
      detail: { summary: "Upload the current user's avatar" },
    },
  )

  .delete(
    '/me/avatar',
    async ({ user: sessionUser }) => {
      const current = requireUser(sessionUser);
      await clearAvatar(current.id, sessionUser?.image);
      return noContent();
    },
    {
      response: { 204: t.Void(), ...errors(401) },
      detail: { summary: "Remove the current user's avatar" },
    },
  )

  // Public preview URL: unauthenticated so it works in an <img> tag. The id is an
  // unguessable uuid. Only raster image types are stored, and nosniff plus the
  // media allowlist keep the bytes from being interpreted as anything executable.
  .get(
    '/avatars/:id/raw',
    async ({ params }) => {
      const obj = await readAvatar(params.id);
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
      params: avatarParams,
      // Public route: no 401/403. Returns raw bytes, so no typed 200 body.
      response: { ...errors(404) },
      detail: { summary: "Preview a user's avatar (public, no auth)" },
    },
  );
