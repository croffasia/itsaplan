'use client';

import { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useInitiativeQuery, useUpdateInitiative } from '@/services/initiatives.service';
import { Input } from '@/components/ui/input';

// The current initiative name as the last segment of the app header breadcrumb.
// Plain text at rest, an inline input on double-click; Enter or blur saves, Escape
// cancels. Editing is gated on the initiatives edit permission.
export default function InitiativeBreadcrumbName({
  initiativeId,
  projectKey,
}: {
  initiativeId: number;
  projectKey: string;
}) {
  const { can } = usePermissions();
  const { data } = useInitiativeQuery(initiativeId);
  const update = useUpdateInitiative(projectKey);
  const title = data?.title ?? '';
  const canEdit = can('initiatives', 'edit');

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  useEffect(() => setDraft(title), [title]);

  if (!data) return <span className="truncate font-medium">…</span>;

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) update.mutate({ id: initiativeId, patch: { title: next } });
    else setDraft(title);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            setDraft(title);
            setEditing(false);
          }
        }}
        className="h-auto w-56 border-0 bg-transparent px-0 py-0 text-sm font-medium shadow-none focus-visible:ring-0"
      />
    );
  }

  return (
    <span
      className={`truncate font-medium ${canEdit ? 'cursor-text' : ''}`}
      onDoubleClick={canEdit ? () => setEditing(true) : undefined}
      title={canEdit ? 'Double-click to rename' : undefined}
    >
      {title}
    </span>
  );
}
