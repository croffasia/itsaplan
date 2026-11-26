'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { IssueDetail } from '@/lib/api/endpoints/issues';
import { useSession } from '@/lib/auth-client';
import { usePermissions } from '@/hooks/usePermissions';
import { formatMinutes } from '@/utils/estimate';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import {
  useCreateWorklog,
  useDeleteWorklog,
  useUpdateWorklog,
  useWorklogsQuery,
} from '../../services/worklogs.service';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';
import IssueWorklogForm from './IssueWorklogForm';
import IssueWorklogRow from './IssueWorklogRow';

// The time logged on the issue: the entries newest day first, and the control that
// adds one. The tally in the heading is the time the issue took, so it reads
// without opening the section. A member logs against any issue they may edit, and
// owns the entries they logged: changing or deleting someone else's is a project
// owner's call. With nothing logged the section stays off the page until the person
// opens the form, here or from the issue's add bar.
export default function IssueWorklogPanel({
  project,
  issue,
  adding,
  onAddingChange,
}: {
  project: ProjectDetail;
  issue: IssueDetail;
  // Whether the form for a new entry is open. Held by the issue detail, whose add bar
  // opens it too.
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
}) {
  const t = useTranslations('issue.worklog');
  const tCommon = useTranslations('common');
  const { can, isOwner } = usePermissions();
  const canLog = can('work_items', 'edit');
  const currentUserId = useSession().data?.user.id ?? null;
  const { open, toggle } = usePersistedOpen('issue-worklog-open');
  const [editingId, setEditingId] = useState<number | null>(null);

  const projectKey = project.project.ref;
  const entries = useWorklogsQuery(issue.id).data ?? [];
  const createWorklog = useCreateWorklog();
  const updateWorklog = useUpdateWorklog();
  const deleteWorklog = useDeleteWorklog();
  // Opening the form from the add bar has to show it, whatever the heading was left at.
  const expanded = open || adding;

  if (entries.length === 0 && !adding) return null;

  return (
    <IssueSection collapsed={!expanded}>
      <IssueSectionHeading
        label={t('title')}
        open={expanded}
        onToggle={toggle}
        tally={issue.loggedMinutes > 0 ? formatMinutes(issue.loggedMinutes) : undefined}
        actions={
          expanded &&
          canLog &&
          !adding && (
            <IssueSectionAddButton label={tCommon('add')} onClick={() => onAddingChange(true)} />
          )
        }
      />

      {expanded && (
        <>
          {adding && (
            <div className="mb-2">
              <IssueWorklogForm
                saving={createWorklog.isPending}
                onCancel={() => onAddingChange(false)}
                onSubmit={(input) => {
                  createWorklog.mutate({ issueId: issue.id, projectKey, input });
                  onAddingChange(false);
                }}
              />
            </div>
          )}

          {entries.length > 0 && (
            <div className="-mx-2 flex flex-col">
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
    </IssueSection>
  );
}
