import { t } from 'elysia';

// The token is a UUID column; validating its format here turns a malformed token
// into a 400 rather than letting it reach Postgres as a 500.
const token = t.String({ format: 'uuid' });

export const shareIssueParams = t.Object({ issueId: t.Numeric() });
export const shareViewParams = t.Object({ viewId: t.Numeric() });
export const shareDocumentParams = t.Object({ documentId: t.Numeric() });
export const shareTokenParams = t.Object({ token });
export const sharedViewIssueParams = t.Object({ token, issueId: t.Numeric() });
export const sharedDocumentPageParams = t.Object({ token, documentId: t.Numeric() });
export const sharedDocumentAssetParams = t.Object({
  token,
  publicId: t.String({ format: 'uuid' }),
});

// The shared documents whose links show an issue.
export const IssueDocumentSharesResponse = t.Array(
  t.Object({
    documentId: t.Number(),
    title: t.String(),
    expiresAt: t.Nullable(t.String({ format: 'date-time' })),
  }),
);

// The share link's token and expiry, returned when sharing is enabled.
export const ShareTokenResponse = t.Object({
  token: t.String(),
  expiresAt: t.Nullable(t.String({ format: 'date-time' })),
});

const expiresAt = t.Optional(
  t.Nullable(
    t.String({
      format: 'date-time',
      description:
        'When the link stops working, as an ISO 8601 timestamp in the future. null makes it never expire; omit to leave it unchanged. An expired link is revoked and enabling sharing again issues a new link.',
    }),
  ),
);

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
    expiresAt,
  }),
);

export const shareDocumentBody = t.Optional(
  t.Object({
    includeChildren: t.Optional(
      t.Boolean({
        description: "Also open the page's subpages through the link. Omit to leave it unchanged.",
      }),
    ),
    includeIssues: t.Optional(
      t.Boolean({
        description:
          'Show the identifier, title and state of the issues of this project that the shared pages name. Omit to leave it unchanged.',
      }),
    ),
    expiresAt,
  }),
);

// The public read-only bundles mirror the service DTOs (project scaffold + entity),
// which the read-only web pages type themselves. They are self-contained reads,
// so the response is passed through rather than re-declaring the five feature DTOs
// they compose.
export const BundleResponse = t.Any();
