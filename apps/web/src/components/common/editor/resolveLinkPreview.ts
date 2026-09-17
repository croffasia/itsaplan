import { ApiError } from '@/lib/api/core/client';
import { getLinkPreview, type LinkPreview } from '@/lib/api/endpoints/link-previews';
import { getProject } from '@/lib/api/endpoints/projects';
import { getIssue, getIssueBySeq } from '@/lib/api/endpoints/issues';
import { getNoteBoard } from '@/lib/api/endpoints/noteBoards';
import { getDocument } from '@/lib/api/endpoints/documents';
import { listViews } from '@/lib/api/endpoints/views';
import { normalizeSavedDisplay } from '@/utils/viewSettings';
import { internalLinkTarget } from './internalLinkTarget';
import { previewExcerpt } from './previewExcerpt';
import { viewPreviewFilters, type PreviewFilter } from './viewPreviewFilters';

export type ResolvedLinkPreview = LinkPreview & {
  kind?: 'project' | 'issue' | 'notes' | 'document' | 'view';
  status?: { name: string; color: string };
  updatedAt?: string;
  noteCount?: number;
  layout?: string;
  filters?: PreviewFilter[];
};

async function resolveInternalLinkPreview(
  url: URL,
  signal: AbortSignal,
): Promise<ResolvedLinkPreview> {
  const empty: LinkPreview = {
    url: url.href,
    title: null,
    description: null,
    image: null,
    siteName: null,
  };
  const target = internalLinkTarget(url);
  if (!target) return empty;
  if (target.kind === 'issue' || target.kind === 'issueId') {
    const issue =
      target.kind === 'issue'
        ? await getIssueBySeq(target.projectKey, target.id, signal)
        : await getIssue(target.id, signal);
    const projectKey = issue.identifier.replace(/-\d+$/, '');
    const project = await getProject(projectKey, signal);
    return {
      ...empty,
      kind: 'issue',
      title: `${issue.identifier} · ${issue.title}`,
      description: previewExcerpt(issue.description),
      siteName: project.project.name,
      status: project.columns.find((column) => column.id === issue.columnId),
      updatedAt: issue.updatedAt,
    };
  }
  const project = await getProject(target.projectKey, signal);
  const base = { ...empty, siteName: project.project.name };
  switch (target.kind) {
    case 'project':
      return {
        ...base,
        kind: 'project',
        title: project.project.name,
        description: previewExcerpt(project.project.description),
        siteName: project.project.key,
      };
    case 'document': {
      const document = await getDocument(target.projectKey, target.id, signal);
      return {
        ...base,
        kind: 'document',
        title: document.title,
        description: previewExcerpt(document.content),
        updatedAt: document.updatedAt,
      };
    }
    case 'notes': {
      const board = await getNoteBoard(target.projectKey, target.id, signal);
      const notes = Array.isArray(board.canvas?.nodes) ? board.canvas.nodes : [];
      const summary = notes
        .slice(0, 3)
        .map((node) =>
          [node.data?.title, node.data?.body].filter((part) => typeof part === 'string').join(' '),
        )
        .join('\n');
      return {
        ...base,
        kind: 'notes',
        title: board.name,
        description: previewExcerpt(summary),
        noteCount: notes.length,
        updatedAt: board.updatedAt,
      };
    }
    case 'view': {
      const views = await listViews(target.projectKey, signal);
      const view = views.find((item) => item.id === target.id);
      if (!view) throw new ApiError(404, 'View not found');
      return {
        ...base,
        kind: 'view',
        title: view.name,
        description: null,
        layout: normalizeSavedDisplay(view.display).layout,
        filters: viewPreviewFilters(view, project),
      };
    }
  }
}

export function resolveLinkPreview(
  url: string,
  origin: string,
  signal: AbortSignal,
): Promise<ResolvedLinkPreview> {
  const target = new URL(url, origin);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password)
    throw new ApiError(400, 'Invalid preview URL');
  if (target.origin === origin) return resolveInternalLinkPreview(target, signal);
  return getLinkPreview(target.href, signal);
}
