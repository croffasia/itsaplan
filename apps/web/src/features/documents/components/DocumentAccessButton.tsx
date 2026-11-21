'use client';

import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import AccessList from '@/components/common/access/AccessList';
import AccessPicker from '@/components/common/access/AccessPicker';
import { ACCESS_ICON } from '@/components/common/access/accessVisibility';
import { Button } from '@/components/ui/button';
import { useDocumentAccessLabels } from '../hooks/useDocumentAccessLabels';
import { useDocumentAccessCandidates } from '../services/documents.service';

// Who sees the page. Its owner picks between the project, themselves and chosen
// members. Anyone else gets the list of who a restricted page is shared with.
export default function DocumentAccessButton({
  projectKey,
  document,
  canChange,
  disabled,
  onChange,
}: {
  projectKey: string;
  document: ProjectDocument;
  canChange: boolean;
  disabled: boolean;
  onChange: (isPrivate: boolean, memberIds?: string[]) => void;
}) {
  const labels = useDocumentAccessLabels();
  const { data: candidates } = useDocumentAccessCandidates(canChange ? projectKey : null);
  const Icon = ACCESS_ICON[document.visibility];

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={labels.access}
      title={labels.visibility[document.visibility]}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon />
    </Button>
  );

  if (canChange) {
    return (
      <AccessPicker
        trigger={trigger}
        visibility={document.visibility}
        memberIds={document.memberIds}
        candidates={candidates}
        labels={labels}
        busy={disabled}
        onChange={(visibility, memberIds) =>
          visibility === 'public' ? onChange(false) : onChange(true, memberIds ?? [])
        }
      />
    );
  }
  if (document.visibility !== 'restricted') return null;
  return (
    <AccessList
      trigger={trigger}
      ownerUserId={document.ownerUserId}
      memberIds={document.memberIds}
      labels={labels}
    />
  );
}
