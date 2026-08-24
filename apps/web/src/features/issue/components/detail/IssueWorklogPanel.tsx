'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type IssueDetail, type ProjectDetail } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { usePermissions } from '@/hooks/usePermissions';
import { formatMinutes } from '@/utils/estimate';
import { Button } from '@/components/ui/button';
import { usePersistedOpen } from '../../hooks/usePersistedOpen';
import {
  useCreateWorklog,
  useDeleteWorklog,
  useUpdateWorklog,
  useWorklogsQuery,
} from '../../services/worklogs.service';
import IssueSectionHeading from './IssueSectionHeading';
import IssueWorklogForm from './IssueWorklogForm';
import IssueWorklogRow from './IssueWorklogRow';

// The time logged on the issue: the entries newest day first, and the control that
// adds one. The tally in the heading is the time the issue took, so it reads
// without opening the section. A member logs against any issue they may edit, and
// owns the entries they logged: changing or deleting someone else's is a project
// owner's call.
export default function IssueWorklogPanel({
  project,
  issue,
}: {
  project: ProjectDetail;
  issue: IssueDetail;
}) {
  const t = useTranslations('issue.worklog');
  const tCommon = useTranslations('common');
  const { can, isOwner } = usePermissions();
  const canLog = can('work_items', 'edit');
  const currentUserId = useSession().data?.user.id ?? null;
  const { open, toggle } = usePersistedOpen('issue-worklog-open');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const projectKey = project.project.key;
  const entries = useWorklogsQuery(issue.id).data ?? [];
  const createWorklog = useCreateWorklog();
  const updateWorklog = useUpdateWorklog();
  const deleteWorklog = useDeleteWorklog();

  return (
    <div className={`mt-6 border-t pt-5 ${open ? '' : '-mb-2'}`}>
      <div className={`flex h-7 items-center justify-between gap-3 ${open ? 'mb-3' : ''}`}>
        <IssueSectionHeading
          label={t('title')}
          open={open}
          onToggle={toggle}
          tally={issue.loggedMinutes > 0 ? formatMinutes(issue.loggedMinutes) : undefined}
        />
        {open && canLog && !adding && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> {tCommon('add')}
          </Button>
        )}
      </div>

      {open && (
        <>
          {adding && (
            <div className="mb-2">
              <IssueWorklogForm
                saving={createWorklog.isPending}
                onCancel={() => setAdding(false)}
                onSubmit={(input) => {
                  createWorklog.mutate({ issueId: issue.id, projectKey, input });
                  setAdding(false);
                }}
              />
            </div>
          )}

          {entries.length === 0 && !adding ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              {canLog ? t('emptyHint') : t('empty')}
            </p>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) =>
                entry.id === editingId ? (
                  <IssueWorklogForm
                    key={entry.id}
                    entry={entry}
                    saving={updateWorklog.isPending}
                    onCancel={() => setEditingId(null)}
                    onSubmit={(patch) => {
                      updateWorklog.mutate({
                        issueId: issue.id,
                        projectKey,
                        worklogId: entry.id,
                        patch,
                      });
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <IssueWorklogRow
                    key={entry.id}
                    entry={entry}
                    canEdit={canLog && (entry.userId === currentUserId || isOwner)}
                    onEdit={() => setEditingId(entry.id)}
                    onRemove={() =>
                      deleteWorklog.mutate({ issueId: issue.id, projectKey, worklogId: entry.id })
                    }
                  />
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
