import type { SavedViewDisplay } from '@/utils/viewSettings';
import { request } from '@/lib/api/core/client';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import type { BoardIssue, IssueRelations } from '@/lib/api/endpoints/issues';
import type { Assignee, ProjectScaffold } from '@/lib/api/endpoints/projects';

// Public read-only share bundles, returned by the /share/* routes with no session.
// The scaffold mirrors ProjectScaffold minus the caller's viewer/permissions and
// member emails and handles (a public page shows names and avatars only).
export type PublicScaffold = Omit<
  ProjectScaffold,
  'viewer' | 'permissions' | 'assignees' | 'sharingEnabled'
> & {
  assignees: Omit<Assignee, 'email' | 'username' | 'canReadWorkItems'>[];
};

export interface SharedIssueBundle {
  project: PublicScaffold;
  issue: IssueRelations;
  feed: FeedItem[];
}

export interface SharedViewBundle {
  project: PublicScaffold;
  // The view's own filters stay on the server: it has already applied them to the
  // issues below, and they can name assignees, labels and custom field values a
  // link without `extended` withholds.
  view: {
    name: string;
    icon: string | null;
    display: SavedViewDisplay;
    // Whether the link exposes the full issues or only their title, description,
    // state, type, priority, dates, subtasks and links.
    extended: boolean;
  };
  issues: BoardIssue[];
}

export interface SharedDocumentPage {
  id: number;
  parentId: number | null;
  title: string;
  icon: string | null;
}

// A shared page, or one of its subpages. Asset URLs in the content already point at
// the token-scoped media route.
export interface SharedDocumentBundle {
  project: { name: string; key: string };
  document: {
    id: number;
    title: string;
    icon: string | null;
    content: string;
    contentJson: Record<string, unknown> | null;
    fullWidth: boolean;
    updatedAt: string;
  };
  // The pages the link opens, the shared page first with no parent.
  pages: SharedDocumentPage[];
  // The issues of the project the page names, when the link shows them.
  issues: SharedDocumentIssue[];
}

// An issue a shared page names. It opens through the same link (getSharedDocumentIssue).
export interface SharedDocumentIssue {
  id: number;
  sequence: number;
  title: string;
  state: { name: string; color: string };
}

// A shared document whose link shows an issue.
export interface IssueDocumentShare {
  documentId: number;
  title: string;
  expiresAt: string | null;
}

// Public read-only sharing. Enabling returns the link token and its expiry and sets
// what it exposes (`extended`, or a document's `includeChildren` and `includeIssues`) and when it stops working; calling it again on a shared
// entity keeps the link and only changes what is sent (an omitted field stays as
// it is, expiresAt null means never). An expired link is replaced by a new one.
// Disable revokes it. The getShared* reads need no session (public /share/* routes).
export interface ShareOptions {
  extended?: boolean;
  includeChildren?: boolean;
  includeIssues?: boolean;
  expiresAt?: string | null;
}

export interface ShareState {
  token: string;
  expiresAt: string | null;
}

export const enableIssueShare = (id: number, options: ShareOptions) =>
  request<ShareState>(`/issues/${id}/share`, {
    method: 'POST',
    body: JSON.stringify(options),
  });

export const disableIssueShare = (id: number) =>
  request<void>(`/issues/${id}/share`, { method: 'DELETE' });

export const enableViewShare = (id: number, options: ShareOptions) =>
  request<ShareState>(`/views/${id}/share`, {
    method: 'POST',
    body: JSON.stringify(options),
  });

export const disableViewShare = (id: number) =>
  request<void>(`/views/${id}/share`, { method: 'DELETE' });

export const getSharedIssue = (token: string) =>
  request<SharedIssueBundle>(`/share/issue/${token}`);

export const getSharedView = (token: string) => request<SharedViewBundle>(`/share/view/${token}`);

export const getSharedViewIssue = (token: string, issueId: number) =>
  request<SharedIssueBundle>(`/share/view/${token}/issues/${issueId}`);

export const enableDocumentShare = (id: number, options: ShareOptions) =>
  request<ShareState>(`/documents/${id}/share`, {
    method: 'POST',
    body: JSON.stringify(options),
  });

export const disableDocumentShare = (id: number) =>
  request<void>(`/documents/${id}/share`, { method: 'DELETE' });

export const getSharedDocumentIssue = (token: string, issueId: number) =>
  request<SharedIssueBundle>(`/share/document/${token}/issues/${issueId}`);

export const listIssueDocumentShares = (issueId: number) =>
  request<IssueDocumentShare[]>(`/issues/${issueId}/share/documents`);

// The live public links of a project, of the kinds the caller may read, and which kinds
// the caller may revoke.
export interface ProjectShares {
  issues: {
    id: number;
    sequence: number;
    title: string;
    extended: boolean;
    expiresAt: string | null;
  }[];
  views: { id: number; name: string; extended: boolean; expiresAt: string | null }[];
  documents: {
    id: number;
    title: string;
    includeChildren: boolean;
    includeIssues: boolean;
    expiresAt: string | null;
  }[];
  canRevoke: { issues: boolean; views: boolean; documents: boolean };
}

export const listProjectShares = (projectKey: string) =>
  request<ProjectShares>(`/projects/${projectKey}/shares`);

// Revokes every link of the kinds the caller may revoke.
export const revokeProjectShares = (projectKey: string) =>
  request<{ revoked: number }>(`/projects/${projectKey}/shares`, { method: 'DELETE' });

export const getSharedDocument = (token: string, documentId?: number) =>
  request<SharedDocumentBundle>(
    documentId ? `/share/document/${token}/documents/${documentId}` : `/share/document/${token}`,
  );
