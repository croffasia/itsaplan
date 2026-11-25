import type { DocumentPinPlacement, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import type { DocumentVisit } from '@/hooks/useDocumentNavigation';
import { documentChildren } from './documentTree';

const HOME_RECENT_LIMIT = 8;

export interface DocumentHomeCard {
  page: ProjectDocumentSummary;
  children: ProjectDocumentSummary[];
  // The latest update of the page and its direct subpages.
  updatedAt: string;
}

export interface DocumentHomeRecentItem {
  document: ProjectDocumentSummary;
  at: number;
}

export type DocumentHomeDay = 'today' | 'yesterday' | 'week' | 'earlier';

const DAYS: DocumentHomeDay[] = ['today', 'yesterday', 'week', 'earlier'];

// A card for each pinned page in the order the project chose, from the list of live pages the
// viewer can read.
export function documentHomePinned(documents: ProjectDocumentSummary[]): DocumentHomeCard[] {
  return documents
    .filter((document) => document.isPinned)
    .sort((a, b) => (a.pinPosition ?? 0) - (b.pinPosition ?? 0) || a.id - b.id)
    .map((page) => {
      const children = documentChildren(page.id, documents);
      const updatedAt = children.reduce(
        (latest, child) =>
          Date.parse(child.updatedAt) > Date.parse(latest) ? child.updatedAt : latest,
        page.updatedAt,
      );
      return { page, children, updatedAt };
    });
}

// The pinned pages a pinned page sits between once the pinned pages are in the order `ids`.
export function documentPinPlacement(ids: number[], documentId: number): DocumentPinPlacement {
  const index = ids.indexOf(documentId);
  return { afterId: ids[index - 1], beforeId: ids[index + 1] };
}

// The pinned pages in the order `ids`, numbered 1024 apart until the list reloads with the
// places the server gave them.
export function applyDocumentPinOrder(
  documents: ProjectDocumentSummary[],
  ids: number[],
): ProjectDocumentSummary[] {
  const places = new Map(ids.map((id, index) => [id, (index + 1) * 1024]));
  return documents.map((document) => {
    const pinPosition = places.get(document.id);
    return pinPosition === undefined ? document : { ...document, pinPosition };
  });
}

// The pages the viewer opened, newest visit first, leaving out pages no longer in the list.
export function documentHomeOpened(
  documents: ProjectDocumentSummary[],
  visits: DocumentVisit[],
): DocumentHomeRecentItem[] {
  const byId = new Map(documents.map((document) => [document.id, document]));
  return visits
    .flatMap((visit) => {
      const document = byId.get(visit.id);
      return document ? [{ document, at: visit.at }] : [];
    })
    .slice(0, HOME_RECENT_LIMIT);
}

export function documentHomeUpdated(documents: ProjectDocumentSummary[]): DocumentHomeRecentItem[] {
  return documents
    .map((document) => ({ document, at: Date.parse(document.updatedAt) }))
    .sort((a, b) => b.at - a.at || b.document.id - a.document.id)
    .slice(0, HOME_RECENT_LIMIT);
}

// Groups by the viewer's calendar day: today, yesterday, the five days before, and earlier.
export function documentHomeDays(
  items: DocumentHomeRecentItem[],
  now: Date,
): { day: DocumentHomeDay; items: DocumentHomeRecentItem[] }[] {
  const daysAgo = (count: number) => {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - count);
    return start.getTime();
  };
  const [today, yesterday, week] = [daysAgo(0), daysAgo(1), daysAgo(6)];
  const dayOf = (at: number): DocumentHomeDay => {
    if (at >= today) return 'today';
    if (at >= yesterday) return 'yesterday';
    if (at >= week) return 'week';
    return 'earlier';
  };
  return DAYS.map((day) => ({ day, items: items.filter((item) => dayOf(item.at) === day) })).filter(
    (group) => group.items.length > 0,
  );
}
