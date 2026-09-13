import { request, uploadFile } from '@/lib/api/core/client';

function withDocumentAssetUrl(asset: DocumentAsset): DocumentAsset {
  const match = asset.url.match(
    /^\/projects\/([^/]+)\/documents\/(\d+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/raw$/i,
  );
  if (!match) throw new Error('The document asset URL returned by the API is invalid');
  const [, encodedProjectKey, documentId, publicId] = match;
  return {
    ...asset,
    url: `/protected-media/projects/${encodeURIComponent(decodeURIComponent(encodedProjectKey))}/documents/${documentId}/assets/${publicId}/raw`,
  };
}

export interface ProjectDocumentSummary {
  id: number;
  projectId: number;
  parentId: number | null;
  title: string;
  icon: string | null;
  metadata: Record<string, unknown>;
  fullWidth: boolean;
  isPrivate: boolean;
  isLocked: boolean;
  isFavorite: boolean;
  archivedAt: string | null;
  position: number;
  version: number;
  ownerUserId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDocument extends ProjectDocumentSummary {
  content: string;
  contentJson: Record<string, unknown> | null;
}

export interface DocumentIssueLink {
  issueId: number;
  sequenceNumber: number;
  identifier: string;
  title: string;
  archived: boolean;
  createdAt: string;
}

export interface IssueDocumentLink {
  documentId: number;
  title: string;
  icon: string | null;
  isPrivate: boolean;
  archived: boolean;
  createdAt: string;
}

export interface NewProjectDocumentInput {
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown> | null;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  fullWidth?: boolean;
  isPrivate?: boolean;
  parentId?: number | null;
}

export interface ProjectDocumentPatch {
  version: number;
  title?: string;
  content?: string;
  contentJson?: Record<string, unknown> | null;
  icon?: string | null;
  metadata?: Record<string, unknown>;
  fullWidth?: boolean;
  parentId?: number | null;
  position?: number;
  previousSiblingId?: number | null;
  nextSiblingId?: number | null;
}

export interface ProjectDocumentRevisionSummary {
  id: number;
  documentId: number;
  version: number;
  title: string;
  createdByUserId: string | null;
  createdAt: string;
}

export interface ProjectDocumentRevision extends ProjectDocumentRevisionSummary {
  parentId: number | null;
  content: string;
  contentJson: Record<string, unknown> | null;
  icon: string | null;
  metadata: Record<string, unknown>;
  fullWidth: boolean;
  isPrivate: boolean;
  isLocked: boolean;
  archivedAt: string | null;
  position: number;
}

export interface DocumentAsset {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: string;
  url: string;
}

export const listDocuments = (projectKey: string, q?: string, archived = false) => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (archived) params.set('archived', 'true');
  const suffix = params.size > 0 ? `?${params}` : '';
  return request<ProjectDocumentSummary[]>(`/projects/${projectKey}/documents${suffix}`);
};

export const getDocument = (projectKey: string, documentId: number, signal?: AbortSignal) =>
  request<ProjectDocument>(`/projects/${encodeURIComponent(projectKey)}/documents/${documentId}`, {
    signal,
  });

export const listDocumentIssueLinks = (projectKey: string, documentId: number) =>
  request<DocumentIssueLink[]>(`/projects/${projectKey}/documents/${documentId}/issues`);

export const listIssueDocumentLinks = (projectKey: string, issueId: number) =>
  request<IssueDocumentLink[]>(`/projects/${projectKey}/documents/for-issue/${issueId}`);

export const linkDocumentIssue = (projectKey: string, documentId: number, issueId: number) =>
  request<DocumentIssueLink>(`/projects/${projectKey}/documents/${documentId}/issues`, {
    method: 'POST',
    body: JSON.stringify({ issueId }),
  });

export const unlinkDocumentIssue = (projectKey: string, documentId: number, issueId: number) =>
  request<void>(`/projects/${projectKey}/documents/${documentId}/issues/${issueId}`, {
    method: 'DELETE',
  });

export const listInitiativeDocumentLinks = (projectKey: string, initiativeId: number) =>
  request<IssueDocumentLink[]>(`/projects/${projectKey}/documents/for-initiative/${initiativeId}`);

export const linkDocumentInitiative = (
  projectKey: string,
  documentId: number,
  initiativeId: number,
) =>
  request<IssueDocumentLink>(`/projects/${projectKey}/documents/${documentId}/initiatives`, {
    method: 'POST',
    body: JSON.stringify({ initiativeId }),
  });

export const unlinkDocumentInitiative = (
  projectKey: string,
  documentId: number,
  initiativeId: number,
) =>
  request<void>(`/projects/${projectKey}/documents/${documentId}/initiatives/${initiativeId}`, {
    method: 'DELETE',
  });

export const createDocument = (projectKey: string, input: NewProjectDocumentInput) =>
  request<ProjectDocument>(`/projects/${projectKey}/documents`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateDocument = (
  projectKey: string,
  documentId: number,
  patch: ProjectDocumentPatch,
) =>
  request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteDocument = (projectKey: string, documentId: number, version: number) =>
  request<void>(`/projects/${projectKey}/documents/${documentId}?version=${version}`, {
    method: 'DELETE',
  });

export const setDocumentAccess = (
  projectKey: string,
  documentId: number,
  input: { version: number; isPrivate: boolean },
) =>
  request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/access`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const setDocumentLocked = (
  projectKey: string,
  documentId: number,
  version: number,
  locked: boolean,
) =>
  request<ProjectDocument>(
    `/projects/${projectKey}/documents/${documentId}/${locked ? 'lock' : 'unlock'}`,
    { method: 'POST', body: JSON.stringify({ version }) },
  );

export const archiveDocument = (projectKey: string, documentId: number, version: number) =>
  request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/archive`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });

export const restoreDocument = (projectKey: string, documentId: number, version: number) =>
  request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ version }),
  });

export const duplicateDocument = (
  projectKey: string,
  documentId: number,
  input: { version: number; title?: string; parentId?: number | null },
) =>
  request<ProjectDocument>(`/projects/${projectKey}/documents/${documentId}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const setDocumentFavorite = (projectKey: string, documentId: number, isFavorite: boolean) =>
  request<{ isFavorite: boolean }>(`/projects/${projectKey}/documents/${documentId}/preferences`, {
    method: 'PATCH',
    body: JSON.stringify({ isFavorite }),
  });

export const listDocumentRevisions = (projectKey: string, documentId: number) =>
  request<ProjectDocumentRevisionSummary[]>(
    `/projects/${projectKey}/documents/${documentId}/revisions`,
  );

export const getDocumentRevision = (projectKey: string, documentId: number, revisionId: number) =>
  request<ProjectDocumentRevision>(
    `/projects/${projectKey}/documents/${documentId}/revisions/${revisionId}`,
  );

export const restoreDocumentRevision = (
  projectKey: string,
  documentId: number,
  revisionId: number,
  version: number,
) =>
  request<ProjectDocument>(
    `/projects/${projectKey}/documents/${documentId}/revisions/${revisionId}/restore`,
    { method: 'POST', body: JSON.stringify({ version }) },
  );

export const listDocumentAssets = (projectKey: string, documentId: number) =>
  request<DocumentAsset[]>(`/projects/${projectKey}/documents/${documentId}/assets`).then(
    (assets) => assets.map(withDocumentAssetUrl),
  );

export const uploadDocumentAsset = (projectKey: string, documentId: number, file: File) =>
  uploadFile<DocumentAsset>(
    `/projects/${projectKey}/documents/${documentId}/assets`,
    'POST',
    file,
  ).then(withDocumentAssetUrl);

export const deleteDocumentAsset = (projectKey: string, documentId: number, publicId: string) =>
  request<void>(
    `/projects/${projectKey}/documents/${documentId}/assets/${encodeURIComponent(publicId)}`,
    { method: 'DELETE' },
  );
