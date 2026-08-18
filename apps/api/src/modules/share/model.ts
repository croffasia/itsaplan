import { t } from 'elysia';

// The token is a UUID column; validating its format here turns a malformed token
// into a 400 rather than letting it reach Postgres as a 500.
const token = t.String({ format: 'uuid' });

export const shareIssueParams = t.Object({ issueId: t.Numeric() });
export const shareViewParams = t.Object({ viewId: t.Numeric() });
export const shareTokenParams = t.Object({ token });
export const sharedViewIssueParams = t.Object({ token, issueId: t.Numeric() });

// The share link's token, returned when sharing is enabled.
export const ShareTokenResponse = t.Object({ token: t.String() });

// How much the link exposes, sent when enabling it. Enabling an already-shared
// entity keeps its token and only changes this; leaving the field out keeps that
// as it stands too, so fetching the link of a live share cannot downgrade it.
export const shareExtendedBody = t.Optional(
  t.Object({
    extended: t.Optional(
      t.Boolean({
        description:
          'Expose the full issues (assignees, labels, custom fields, activity) instead of their title, description, state, type, priority, dates, subtasks and links. Omit to leave it unchanged.',
      }),
    ),
  }),
);

// The public read-only bundles mirror the service DTOs (project scaffold + entity),
// which the read-only web pages type themselves. They are self-contained reads,
// so the response is passed through rather than re-declaring the five feature DTOs
// they compose.
export const BundleResponse = t.Any();
