'use client';

import { useState, type ReactNode } from 'react';
import { type Issue, type ProjectDetail } from '@/lib/api';
import { subtaskCount } from '@/utils/subtasks';
import { useArchiveIssue } from '@/services/issues.service';
import ArchiveIssueDialog from '../components/actions/ArchiveIssueDialog';

// Archiving one issue from a menu, a bar or a command. An issue with subtasks
// first has to say what happens to them, so it goes through the confirmation the
// hook mounts; one without them is archived straight away. onArchived runs after
// either path, for the caller to leave the issue it just archived.
export function useArchiveAction(
  // Null where the project is still loading (the command palette mounts before
  // it), which leaves the action inert.
  project: ProjectDetail | null,
  onArchived?: () => void,
): { archive: (issue: Issue) => void; dialog: ReactNode } {
  const archiveIssue = useArchiveIssue(project?.project.key ?? null);
  const [confirming, setConfirming] = useState<Issue | null>(null);

  const archive = (issue: Issue) => {
    if (!project) return;
    if (subtaskCount(project.issues, [issue.id]) > 0) {
      setConfirming(issue);
      return;
    }
    archiveIssue.mutate({ id: issue.id });
    onArchived?.();
  };

  const dialog =
    project && confirming ? (
      <ArchiveIssueDialog
        project={project}
        issue={confirming}
        onClose={() => setConfirming(null)}
        onArchived={onArchived}
      />
    ) : null;

  return { archive, dialog };
}
