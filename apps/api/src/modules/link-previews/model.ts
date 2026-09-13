import { t } from 'elysia';

export const linkPreviewQuery = t.Object({ url: t.String({ minLength: 1, maxLength: 4096 }) });

export const LinkPreviewResponse = t.Object({
  url: t.String(),
  title: t.Nullable(t.String()),
  description: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  siteName: t.Nullable(t.String()),
});
