import { ClockIcon } from '@animateicons/react/lucide/clock-icon';
import { FileTextIcon } from '@animateicons/react/lucide/file-text-icon';
import { GitBranchIcon } from '@animateicons/react/lucide/git-branch-icon';
import { LinkIcon } from '@animateicons/react/lucide/link-icon';
import { ListTreeIcon } from '@animateicons/react/lucide/list-tree-icon';
import { PaperclipIcon } from '@animateicons/react/lucide/paperclip-icon';
import { SquareCheckIcon } from '@animateicons/react/lucide/square-check-icon';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { IssueWithWatchers } from '@/lib/api/endpoints/issues';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectFeatures } from '@/hooks/useProjectFeatures';
import { canHaveSubtasks } from '@/utils/subtasks';
import IssueAddBarButton from './IssueAddBarButton';
import IssueDevelopmentAddMenu from './IssueDevelopmentAddMenu';
import type { IssueDevelopmentAdding } from './IssueDevelopmentPanel';
import IssueLinksAddMenu from './IssueLinksAddMenu';
import type { IssueLinkAdding } from './IssueLinksPanel';
import IssueSubtasksAddMenu from './IssueSubtasksAddMenu';
import type { IssueSubtaskAdding } from './IssueSubtasksPanel';
import { useTranslations } from 'next-intl';

// What the person started adding, from this bar or from a section's own heading. The
// section shows while it holds it, even with nothing in it yet, and clears it when the
// dialog or the inline form closes.
export type IssueAddTarget =
  | { section: 'subtasks'; mode: IssueSubtaskAdding }
  | { section: 'checklists' }
  | { section: 'worklog' }
  | { section: 'documents' }
  | { section: 'development'; mode: IssueDevelopmentAdding }
  | ({ section: 'links' } & IssueLinkAdding);

// One row of everything that can be added to the issue. The sections under it show
// only when they have something in them, so this row is where an empty one starts.
export default function IssueAddBar({
  project,
  issue,
  onAdd,
  onAddFiles,
  className,
}: {
  project: ProjectDetail;
  issue: IssueWithWatchers;
  onAdd: (target: IssueAddTarget) => void;
  // Opens the file picker of the Attachments section. It runs inside the click, which
  // a browser requires before it shows the picker.
  onAddFiles: () => void;
  className?: string;
}) {
  const t = useTranslations('issue.addBar');
  const permissions = usePermissions(project);
  const features = useProjectFeatures();
  const canEdit = permissions.can('work_items', 'edit');
  const canCreate = permissions.can('work_items', 'create');
  const options = {
    files: canEdit,
    documents: features.documents && canEdit && permissions.can('documents', 'edit'),
    subtasks: features.subtasks && canEdit && canHaveSubtasks(issue),
    checklists: features.checklists && canEdit,
    links: canEdit,
    development: permissions.can('repositories', 'edit'),
    worklog: features.timeLogging && canEdit,
  };
  if (!Object.values(options).some(Boolean)) return null;

  return (
    <div className={className}>
      <div className="-ms-2 flex flex-wrap gap-0.5">
        {options.files && (
          <IssueAddBarButton icon={PaperclipIcon} onClick={onAddFiles}>
            {t('file')}
          </IssueAddBarButton>
        )}
        {options.documents && (
          <IssueAddBarButton icon={FileTextIcon} onClick={() => onAdd({ section: 'documents' })}>
            {t('doc')}
          </IssueAddBarButton>
        )}
        {options.subtasks && (
          <IssueSubtasksAddMenu
            align="start"
            canCreate={canCreate}
            onCreate={() => onAdd({ section: 'subtasks', mode: 'create' })}
            onAttach={() => onAdd({ section: 'subtasks', mode: 'attach' })}
            trigger={<IssueAddBarButton icon={ListTreeIcon}>{t('subtask')}</IssueAddBarButton>}
          />
        )}
        {options.checklists && (
          <IssueAddBarButton
            icon={SquareCheckIcon}
            onClick={() => onAdd({ section: 'checklists' })}
          >
            {t('checklist')}
          </IssueAddBarButton>
        )}
        {options.links && (
          <IssueLinksAddMenu
            align="start"
            canCreate={canCreate}
            onLinkExisting={(relation) => onAdd({ section: 'links', mode: 'link', relation })}
            onCreateNew={(relation) => onAdd({ section: 'links', mode: 'create', relation })}
            trigger={<IssueAddBarButton icon={LinkIcon}>{t('link')}</IssueAddBarButton>}
          />
        )}
        {options.development && (
          <IssueDevelopmentAddMenu
            align="start"
            onLink={() => onAdd({ section: 'development', mode: 'link' })}
            onCreate={() => onAdd({ section: 'development', mode: 'create' })}
            trigger={<IssueAddBarButton icon={GitBranchIcon}>{t('development')}</IssueAddBarButton>}
          />
        )}
        {options.worklog && (
          <IssueAddBarButton icon={ClockIcon} onClick={() => onAdd({ section: 'worklog' })}>
            {t('worklog')}
          </IssueAddBarButton>
        )}
      </div>
    </div>
  );
}
