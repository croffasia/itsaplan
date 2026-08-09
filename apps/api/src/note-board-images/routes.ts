import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { guards } from '../shared/guards';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { getObject } from '../shared/s3';
import {
  assertUploadAllowed,
  discardUploadedObject,
  storeUploadedObject,
  uploadObjectKey,
} from '../shared/uploads';
import { requireAccessibleNoteBoard } from '../note-boards/access';
import { createNoteBoardImage, getNoteBoardImage, type NoteBoardImageRow } from './store';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const imageParams = t.Object({
  projectKey: t.String(),
  boardId: t.Numeric(),
  imageId: t.String({ format: 'uuid' }),
});

const NoteBoardImageResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  createdAt: t.String(),
});

function imageDto(row: NoteBoardImageRow) {
  return {
    id: row.id,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
  };
}

function hasImageSignature(bytes: Buffer, contentType: (typeof IMAGE_TYPES)[number]): boolean {
  if (contentType === 'image/png') {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (contentType === 'image/gif') {
    const signature = bytes.subarray(0, 6).toString('ascii');
    return signature === 'GIF87a' || signature === 'GIF89a';
  }
  return (
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

export const noteBoardImageRoutes = new Elysia({
  name: 'note-board-images',
  detail: { tags: ['Note boards'] },
})
  .use(authContext)
  .use(guards)
  .post(
    '/projects/:projectKey/note-boards/:boardId/images',
    async ({ project, user, params, body, set }) => {
      const userId = requireUser(user).id;
      await requireAccessibleNoteBoard(params.boardId, project.id, userId);
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No photo uploaded');
      if (file.size === 0) throw new HttpError(400, 'Uploaded photo is empty');

      const contentType = file.type.toLowerCase();
      if (!IMAGE_TYPES.includes(contentType as (typeof IMAGE_TYPES)[number])) {
        throw new HttpError(400, 'Only JPEG, PNG, WebP, and GIF photos are accepted');
      }

      await assertUploadAllowed(project.id, file.size, contentType);
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!hasImageSignature(bytes, contentType as (typeof IMAGE_TYPES)[number])) {
        throw new HttpError(400, 'The uploaded file is not a valid image');
      }

      const filename = file.name || 'photo';
      const key = uploadObjectKey(project.id, `note-boards/${params.boardId}`, filename);
      await storeUploadedObject(key, bytes, contentType);
      try {
        const image = await createNoteBoardImage({
          boardId: params.boardId,
          uploadedByUserId: userId,
          s3Key: key,
          filename,
          contentType,
          sizeBytes: file.size,
        });
        set.status = 201;
        return imageDto(image);
      } catch (error) {
        await discardUploadedObject(key);
        throw error;
      }
    },
    {
      permission: ['note_boards', 'edit'],
      params: t.Object({ projectKey: t.String(), boardId: t.Numeric() }),
      body: t.Object({ file: t.File() }),
      response: {
        201: NoteBoardImageResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        413: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Upload a photo to a note board' },
    },
  )
  .get(
    '/projects/:projectKey/note-boards/:boardId/images/:imageId/raw',
    async ({ project, user, params }) => {
      await requireAccessibleNoteBoard(params.boardId, project.id, requireUser(user).id);
      const row = await getNoteBoardImage(params.boardId, params.imageId);
      if (!row) throw new HttpError(404, 'Photo not found');

      let object;
      try {
        object = await getObject(row.s3Key);
      } catch {
        throw new HttpError(404, 'Photo content not found');
      }

      const headers: Record<string, string> = {
        'Content-Type': row.contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      };
      if (object.contentLength != null) headers['Content-Length'] = String(object.contentLength);
      return new Response(object.body, { headers });
    },
    {
      permission: ['note_boards', 'read'],
      params: imageParams,
      response: {
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'View a note board photo' },
    },
  );
