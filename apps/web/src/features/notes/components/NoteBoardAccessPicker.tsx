'use client';

import { useTranslations } from 'next-intl';
import type { NoteBoardVisibility } from '@/lib/api/endpoints/noteBoards';
import AccessPicker from '@/components/common/access/AccessPicker';
import { ACCESS_ICON } from '@/components/common/access/accessVisibility';
import { useNoteBoardAccessLabels } from '../hooks/useNoteBoardAccessLabels';
import { useNoteBoardAccessCandidates } from '../services/noteBoards.service';

// The board access control on the canvas. Only the board creator gets it (the host
// decides).
export default function NoteBoardAccessPicker({
  projectKey,
  visibility,
  memberIds,
  onChange,
}: {
  projectKey: string;
  visibility: NoteBoardVisibility;
  memberIds: string[];
  onChange: (visibility: NoteBoardVisibility, memberIds?: string[]) => void;
}) {
  const t = useTranslations('notes');
  const labels = useNoteBoardAccessLabels();
  const { data: candidates } = useNoteBoardAccessCandidates(projectKey);
  const Icon = ACCESS_ICON[visibility];

  return (
    <AccessPicker
      trigger={
        <button
          type="button"
          aria-label={labels.access}
          title={t(`visibilityHint.${visibility}`)}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Icon className="size-3.5" />
        </button>
      }
      visibility={visibility}
      memberIds={memberIds}
      candidates={candidates}
      labels={labels}
      onChange={onChange}
    />
  );
}
