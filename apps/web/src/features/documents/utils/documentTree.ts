import type { ProjectDocumentSummary } from '@/lib/api';

export function documentAncestors(
  document: ProjectDocumentSummary,
  documents: ProjectDocumentSummary[],
): ProjectDocumentSummary[] {
  const byId = new Map(documents.map((item) => [item.id, item]));
  const seen = new Set<number>([document.id]);
  const ancestors: ProjectDocumentSummary[] = [];
  let parentId = document.parentId;

  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }

  return ancestors;
}
