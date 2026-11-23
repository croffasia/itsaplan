import { Building2, LockKeyhole, Users, type LucideIcon } from 'lucide-react';
import type { DocumentVisibility, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';

// In Docs a globe means a public link, so a page the whole project opens shows a building.
export const DOCUMENT_ACCESS_ICON: Record<DocumentVisibility, LucideIcon> = {
  public: Building2,
  private: LockKeyhole,
  restricted: Users,
};

// The nearest ancestor (`ancestors` is root first) whose public link opens its subpages and
// reaches this page. The link walks down through public, active pages only, so a private
// or archived page in between stops it.
export function sharedThroughAncestor(
  ancestors: ProjectDocumentSummary[],
  sharedWithSubpages: ReadonlySet<number>,
): ProjectDocumentSummary | null {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = ancestors[i];
    if (ancestor.isPrivate || ancestor.archivedAt !== null) return null;
    if (sharedWithSubpages.has(ancestor.id)) return ancestor;
  }
  return null;
}

// A page is managed (archived, restored, deleted, handed over) by its owner or a project owner.
export function managesDocument(
  document: Pick<ProjectDocumentSummary, 'ownerUserId'>,
  userId: string | null,
  isProjectOwner: boolean,
): boolean {
  return userId !== null && (isProjectOwner || document.ownerUserId === userId);
}
