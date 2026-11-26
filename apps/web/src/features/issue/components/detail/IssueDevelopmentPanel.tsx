import type { DevelopmentLink, LinkedRepositoryIssue } from '@/lib/api/endpoints/git';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import IssueDevelopmentAddMenu from './IssueDevelopmentAddMenu';
import IssueDevelopmentCreateDialog from './IssueDevelopmentCreateDialog';
import IssueDevelopmentLinkRow from './IssueDevelopmentLinkRow';
import IssueDevelopmentLinkDialog from './IssueDevelopmentLinkDialog';
import IssueDevelopmentRepositoryIssueRow from './IssueDevelopmentRepositoryIssueRow';
import IssueSection from './IssueSection';
import IssueSectionAddButton from './IssueSectionAddButton';
import IssueSectionHeading from './IssueSectionHeading';
import { useTranslations } from 'next-intl';

export type IssueDevelopmentAdding = 'link' | 'create';

// The pull requests, merge requests and the repository issue linked to the issue.
// The section stays off the page while nothing is linked; the issue's add bar opens
// the same two dialogs as the heading's menu.
export default function IssueDevelopmentPanel({
  issueId,
  identifier,
  issueTitle,
  links,
  repositoryIssue,
  canEdit,
  canManage,
  adding,
  onAddingChange,
}: {
  issueId: number;
  identifier: string;
  issueTitle: string;
  links: DevelopmentLink[];
  repositoryIssue: LinkedRepositoryIssue | null;
  canEdit: boolean;
  canManage: boolean;
  // Which dialog is open. Held by the issue detail, whose add bar opens them too.
  adding: IssueDevelopmentAdding | null;
  onAddingChange: (adding: IssueDevelopmentAdding | null) => void;
}) {
  const t = useTranslations('issue.development');
  const { open, toggle } = usePersistedOpen('issue-development-open');
  const dialogOpenChange = (mode: IssueDevelopmentAdding) => (next: boolean) =>
    onAddingChange(next ? mode : null);

  const dialogs = (
    <>
      <IssueDevelopmentLinkDialog
        issueId={issueId}
        open={adding === 'link'}
        onOpenChange={dialogOpenChange('link')}
      />
      <IssueDevelopmentCreateDialog
        issueId={issueId}
        identifier={identifier}
        issueTitle={issueTitle}
        open={adding === 'create'}
        onOpenChange={dialogOpenChange('create')}
      />
    </>
  );

  if (links.length === 0 && !repositoryIssue) return dialogs;

  return (
    <IssueSection collapsed={!open}>
      <IssueSectionHeading
        label={t('title')}
        tally={String(links.length + (repositoryIssue ? 1 : 0))}
        open={open}
        onToggle={toggle}
        actions={
          canManage && (
            <IssueDevelopmentAddMenu
              onLink={() => onAddingChange('link')}
              onCreate={() => onAddingChange('create')}
              trigger={<IssueSectionAddButton label={t('add')} />}
            />
          )
        }
      />
      {open && (
        <div className="-mx-2 flex flex-col">
          {repositoryIssue && <IssueDevelopmentRepositoryIssueRow issue={repositoryIssue} />}
          {links.map((link) => (
            <IssueDevelopmentLinkRow
              key={link.id}
              issueId={issueId}
              link={link}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
      {dialogs}
    </IssueSection>
  );
}
