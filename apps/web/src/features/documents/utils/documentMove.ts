import type { ProjectDocumentSummary } from '@/lib/api';

export interface OptimisticDocumentMove {
  documentId: number;
  parentId: number | null;
  position: number;
  previousSiblingId: number | null;
  nextSiblingId: number | null;
}

export function applyOptimisticDocumentMove(
  documents: ProjectDocumentSummary[],
  move: OptimisticDocumentMove,
): ProjectDocumentSummary[] {
  const source = documents.find((document) => document.id === move.documentId);
  if (!source) return documents;

  const siblings = documents
    .filter((document) => document.id !== move.documentId && document.parentId === move.parentId)
    .sort(comparePosition);
  const insertionIndex = insertionIndexFromAnchors(siblings, move);
  if (insertionIndex === null) return documents;

  siblings.splice(insertionIndex, 0, {
    ...source,
    parentId: move.parentId,
    position: move.position,
    version: source.version + 1,
  });

  const normalizedPositions = new Map(
    siblings.map((document, index) => [document.id, (index + 1) * 1024]),
  );
  return documents.map((document) => {
    const position = normalizedPositions.get(document.id);
    if (position === undefined) return document;
    if (document.id === move.documentId) {
      return {
        ...document,
        parentId: move.parentId,
        position,
        version: document.version + 1,
      };
    }
    return { ...document, position };
  });
}

export function projectedDocumentMove({
  source,
  target,
  deltaX,
  ordered,
  byParent,
  byId,
}: {
  source: ProjectDocumentSummary;
  target: ProjectDocumentSummary;
  deltaX: number;
  ordered: ProjectDocumentSummary[];
  byParent: Map<number | null, ProjectDocumentSummary[]>;
  byId: Map<number, ProjectDocumentSummary>;
}): Omit<OptimisticDocumentMove, 'documentId'> | null {
  if (source.id === target.id) return null;

  const descendants = descendantIds(source.id, byParent);
  let parentId = target.parentId;
  let anchor = target;
  let placeAfterAnchor = false;

  if (deltaX > 24) {
    if (descendants.has(target.id)) return null;
    parentId = target.id;
  } else if (deltaX < -24 && target.parentId !== null) {
    const parent = byId.get(target.parentId);
    if (!parent) return null;
    parentId = parent.parentId;
    anchor = parent;
    placeAfterAnchor = true;
  } else {
    const sourceIndex = ordered.findIndex((document) => document.id === source.id);
    const targetIndex = ordered.findIndex((document) => document.id === target.id);
    if (sourceIndex < 0 || targetIndex < 0) return null;
    placeAfterAnchor = sourceIndex < targetIndex;
  }

  if (parentId === source.id || (parentId !== null && descendants.has(parentId))) return null;

  const siblings = [...(byParent.get(parentId) ?? [])]
    .filter((document) => document.id !== source.id)
    .sort(comparePosition);
  if (parentId === target.id) {
    const previous = siblings.at(-1);
    return {
      parentId,
      position: positionForRequest(previous, undefined, siblings.length),
      previousSiblingId: previous?.id ?? null,
      nextSiblingId: null,
    };
  }

  const anchorIndex = siblings.findIndex((document) => document.id === anchor.id);
  if (anchorIndex < 0) return null;
  const insertionIndex = anchorIndex + (placeAfterAnchor ? 1 : 0);
  const previous = siblings[insertionIndex - 1];
  const next = siblings[insertionIndex];
  return {
    parentId,
    position: positionForRequest(previous, next, insertionIndex),
    previousSiblingId: previous?.id ?? null,
    nextSiblingId: next?.id ?? null,
  };
}

function insertionIndexFromAnchors(
  siblings: ProjectDocumentSummary[],
  move: Pick<OptimisticDocumentMove, 'previousSiblingId' | 'nextSiblingId'>,
): number | null {
  const previousIndex =
    move.previousSiblingId === null
      ? -1
      : siblings.findIndex((document) => document.id === move.previousSiblingId);
  const nextIndex =
    move.nextSiblingId === null
      ? siblings.length
      : siblings.findIndex((document) => document.id === move.nextSiblingId);

  if (move.previousSiblingId !== null && previousIndex < 0) return null;
  if (move.nextSiblingId !== null && nextIndex < 0) return null;
  if (
    move.previousSiblingId !== null &&
    move.nextSiblingId !== null &&
    previousIndex >= nextIndex
  ) {
    return null;
  }
  if (move.previousSiblingId !== null) return previousIndex + 1;
  if (move.nextSiblingId !== null) return nextIndex;
  return 0;
}

function descendantIds(
  documentId: number,
  byParent: Map<number | null, ProjectDocumentSummary[]>,
): Set<number> {
  const descendants = new Set<number>();
  const pending = [...(byParent.get(documentId) ?? [])];
  while (pending.length > 0) {
    const document = pending.pop()!;
    if (document.id === documentId || descendants.has(document.id)) continue;
    descendants.add(document.id);
    pending.push(...(byParent.get(document.id) ?? []));
  }
  return descendants;
}

function positionForRequest(
  previous: ProjectDocumentSummary | undefined,
  next: ProjectDocumentSummary | undefined,
  insertionIndex: number,
): number {
  if (!previous && !next) return 1;
  if (!previous) return next!.position - 1;
  if (!next) return previous.position + 1;

  const midpoint = previous.position + (next.position - previous.position) / 2;
  if (Number.isFinite(midpoint) && midpoint > previous.position && midpoint < next.position) {
    return midpoint;
  }
  return (insertionIndex + 1) * 1024;
}

function comparePosition(left: ProjectDocumentSummary, right: ProjectDocumentSummary): number {
  return left.position - right.position || left.id - right.id;
}
