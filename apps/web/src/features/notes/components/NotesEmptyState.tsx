'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import NoteBoardNameDialog from './NoteBoardNameDialog';
import type { NewBoardVisibility } from '../utils/visibility';

// Shown when a project has no note boards. It offers to create the first one, so
// it is a click away instead of hidden behind the "+" in the header.
export default function NotesEmptyState({
  projectKey,
  onCreate,
}: {
  projectKey: string;
  onCreate: (name: string, visibility: NewBoardVisibility) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('notes');
  const { can } = usePermissions();
  const canCreate = can('note_boards', 'create');

  return (
    <>
      <EmptyState title={t('emptyTitle')} description={t('emptyDescription')}>
        {canCreate && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            {t('newBoard')}
          </Button>
        )}
      </EmptyState>

      <NoteBoardNameDialog
        key={open ? 'open' : 'closed'}
        open={open}
        title={t('newBoard')}
        description={t('newBoardDescription')}
        projectKey={projectKey}
        initial=""
        withVisibility
        onClose={() => setOpen(false)}
        onSubmit={(name, visibility) => {
          onCreate(name, visibility);
          setOpen(false);
        }}
      />
    </>
  );
}
