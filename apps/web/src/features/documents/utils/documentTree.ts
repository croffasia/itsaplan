import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';

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

// A page whose parent is not in the list counts as a top-level page, as in the
// page tree.
export function documentChildren(
  parentId: number | null,
  documents: ProjectDocumentSummary[],
): ProjectDocumentSummary[] {
  const ids = new Set(documents.map((item) => item.id));
  const visibleParentId = (item: ProjectDocumentSummary) =>
    item.parentId !== null && ids.has(item.parentId) ? item.parentId : null;
  return documents
    .filter((item) => visibleParentId(item) === parentId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}
