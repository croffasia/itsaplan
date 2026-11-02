import type { SavedViewDisplay } from '@/utils/viewSettings';
import { request } from '@/lib/api/core/client';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import type { BoardIssue, IssueRelations } from '@/lib/api/endpoints/issues';
import type { Assignee, ProjectScaffold } from '@/lib/api/endpoints/projects';

// Public read-only share bundles, returned by the /share/* routes with no session.
// The scaffold mirrors ProjectScaffold minus the caller's viewer/permissions and
// member emails and handles (a public page shows names and avatars only).
export type PublicScaffold = Omit<ProjectScaffold, 'viewer' | 'permissions' | 'assignees'> & {
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

// Public read-only sharing. Enabling returns the link token and its expiry and sets
// how much it exposes and when it stops working; calling it again on a shared
// entity keeps the link and only changes what is sent (an omitted field stays as
// it is, expiresAt null means never). An expired link is replaced by a new one.
// Disable revokes it. The getShared* reads need no session (public /share/* routes).
export interface ShareOptions {
  extended?: boolean;
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
