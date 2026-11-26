import { type RefObject } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Attachment } from '@/lib/api/endpoints/attachments';
import type { IssueWithWatchers } from '@/lib/api/endpoints/issues';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import type { IssueAddTarget } from './IssueAddBar';
import IssueAttachmentsPanel from './IssueAttachmentsPanel';
import IssueChecklistsPanel from './IssueChecklistsPanel';
import IssueDevelopmentPanel from './IssueDevelopmentPanel';
import IssueDocumentsPanel from './IssueDocumentsPanel';
import IssueLinksPanel from './IssueLinksPanel';
import IssueSubtasksPanel from './IssueSubtasksPanel';
import IssueWorklogPanel from './IssueWorklogPanel';

// The collapsible sections under the written content, in the order of the add bar.
// Each one shows only when it has something in it or is being added to; what is being
// added is held by the issue detail, which renders the add bar as well.
export default function IssueDetailSections({
  project,
  issue,
  adding,
  onAddingChange,
  fileInput,
  onInsertAttachment,
  onReplaceAttachment,
}: {
  project: ProjectDetail;
  issue: IssueWithWatchers;
  adding: IssueAddTarget | null;
  onAddingChange: (adding: IssueAddTarget | null) => void;
  fileInput: RefObject<HTMLInputElement | null>;
  onInsertAttachment: (attachment: Attachment) => void;
  onReplaceAttachment: () => void;
}) {
  const permissions = usePermissions(project);
  const features = useProjectFeatures();
  const canEdit = permissions.can('work_items', 'edit');

  return (
    <>
      <IssueAttachmentsPanel
        issueId={issue.id}
        fileInput={fileInput}
        onInsert={onInsertAttachment}
        onReplaced={onReplaceAttachment}
        readOnly={!canEdit}
      />

      {features.documents && (
        <IssueDocumentsPanel
          projectKey={project.project.ref}
          issueId={issue.id}
          canRead={permissions.can('documents', 'read')}
          canLink={canEdit && permissions.can('documents', 'edit')}
          adding={adding?.section === 'documents'}
          onAddingChange={(on) => onAddingChange(on ? { section: 'documents' } : null)}
        />
      )}

      {features.subtasks && (
        <IssueSubtasksPanel
          project={project}
          issue={issue}
          adding={adding?.section === 'subtasks' ? adding.mode : null}
          onAddingChange={(mode) => onAddingChange(mode ? { section: 'subtasks', mode } : null)}
        />
      )}

      {features.checklists && (
        <IssueChecklistsPanel
          issue={issue}
          adding={adding?.section === 'checklists'}
          onAddingChange={(on) => onAddingChange(on ? { section: 'checklists' } : null)}
        />
      )}

      <IssueLinksPanel
        project={project}
        issue={issue}
        adding={adding?.section === 'links' ? adding : null}
        onAddingChange={(link) => onAddingChange(link ? { section: 'links', ...link } : null)}
      />

      <IssueDevelopmentPanel
        issueId={issue.id}
        identifier={issue.identifier}
        issueTitle={issue.title}
        links={issue.development ?? []}
        repositoryIssue={issue.repositoryIssue ?? null}
        canEdit={canEdit}
        canManage={permissions.can('repositories', 'edit')}
        adding={adding?.section === 'development' ? adding.mode : null}
        onAddingChange={(mode) => onAddingChange(mode ? { section: 'development', mode } : null)}
      />

      {features.timeLogging && (
        <IssueWorklogPanel
          project={project}
          issue={issue}
          adding={adding?.section === 'worklog'}
          onAddingChange={(on) => onAddingChange(on ? { section: 'worklog' } : null)}
        />
      )}
    </>
  );
}
