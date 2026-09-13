import { Elysia } from 'elysia';
import { authContext } from '#shared/auth-context';
import { errors } from '#shared/responses';
import { linkPreviewQuery, LinkPreviewResponse } from './model';
import { getLinkPreview } from './service';

export const linkPreviewRoutes = new Elysia({
  name: 'link-previews',
  detail: { tags: ['Link previews'] },
})
  .use(authContext)
  .get(
    '/link-previews',
    ({ query, set }) => {
      set.headers['Cache-Control'] = 'private, max-age=300';
      return getLinkPreview(query.url);
    },
    {
      query: linkPreviewQuery,
      response: { 200: LinkPreviewResponse, ...errors(400, 401) },
      detail: {
        summary: 'Preview a public web link',
        description:
          'Read public HTML metadata without sending account cookies or credentials to the destination.',
      },
    },
  );
