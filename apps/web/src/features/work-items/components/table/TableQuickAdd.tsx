'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreateIssue } from '@/services/issues.service';

// Quick-add row shown at the end of an ungrouped table: type a title,
// press Enter, the issue is created directly.
export function TableQuickAdd({
  projectKey,
  columnId,
  readOnly,
}: {
  projectKey: string;
  columnId: number;
  readOnly?: boolean;
}) {
  const t = useTranslations('workItems');
  const { can } = usePermissions();
  const create = useCreateIssue();
  const [title, setTitle] = useState('');

  if (!can('work_items', 'create') || readOnly) return null;

  function submit() {
    const value = title.trim();
    if (!value || create.isPending) return;
    create.mutate({ projectKey, input: { title: value, columnId } });
    setTitle('');
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <Plus className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setTitle('');
        }}
        placeholder={t('newIssue')}
        aria-label={t('newIssue')}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
