'use client';

import type { ProjectDocument, ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { usePersistedOpenGroups } from '@/hooks/usePersistedOpen';
import DocumentDetailsAccessGroup from './DocumentDetailsAccessGroup';
import DocumentDetailsInfoGroup from './DocumentDetailsInfoGroup';

// The Properties grid of the page details: who owns and sees the page, where it sits,
// and when it was written.
export default function DocumentDetailsProperties({
  projectKey,
  document,
  parent,
  wordCount,
  onTransferOwner,
  onOpenAccess,
  onMove,
}: {
  projectKey: string;
  document: ProjectDocument;
  parent: ProjectDocumentSummary | null;
  wordCount: number;
  onTransferOwner?: (userId: string) => void;
  onOpenAccess?: () => void;
  onMove?: () => void;
}) {
  const groups = usePersistedOpenGroups('document-details-groups');

  return (
    <div className="grid grid-cols-[minmax(0,min(40%,180px))_minmax(0,1fr)] items-start gap-x-2 gap-y-2.5 text-sm">
      <DocumentDetailsAccessGroup
        projectKey={projectKey}
        document={document}
        parent={parent}
        open={groups.isOpen('access')}
        onToggle={() => groups.toggle('access')}
        onTransferOwner={onTransferOwner}
        onOpenAccess={onOpenAccess}
        onMove={onMove}
      />
      <DocumentDetailsInfoGroup
        document={document}
        wordCount={wordCount}
        open={groups.isOpen('info')}
        onToggle={() => groups.toggle('info')}
      />
    </div>
  );
}
