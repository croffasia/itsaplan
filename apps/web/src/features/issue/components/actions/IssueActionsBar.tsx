import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Check,
  ClipboardCopy,
  GitBranch,
  Globe,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  api,
  type ActionDef,
  type ProjectDetail,
  type IssueDetail as IssueDetailRow,
} from '@/lib/api';
import { actionIcon } from '@/utils/actionIcons';
import { useActionsQuery } from '@/services/actions.service';
import { useRestoreIssue } from '@/services/issues.service';
import { qk } from '@/services/queryKeys';
import { usePermissions } from '@/hooks/usePermissions';
import { useArchiveAction } from '../../hooks/useArchiveAction';
import { ApplyActionDialog, DeleteIssueDialog, matchedActions } from './IssueActions';
import { buildIssueBranchName, buildIssuePrompt } from '../../utils/issuePrompt';
import { useSession } from '@/lib/auth-client';
import { shareIssuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ShareDialog from '@/components/common/share/ShareDialog';
import { useTranslations } from 'next-intl';

// The issue detail Actions: the manual actions whose condition matches this
// issue, plus Copy Prompt and a delete button. Owns the delete/apply
// confirmations and the mutations they run. The confirm dialogs render through a
// portal, so their position in the tree does not matter.
export default function IssueActionsBar({
  project,
  issue,
  variant = 'row',
  onDeleted,
}: {
  project: ProjectDetail;
  issue: IssueDetailRow;
  // 'row' wraps the buttons in a right-aligned row of its own. 'header' renders
  // them bare, at the smaller size the side panel's header row uses.
  variant?: 'row' | 'header';
  onDeleted?: () => void;
}) {
  const t = useTranslations('issue.actionsBar');
  const { can } = usePermissions();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const actionsQuery = useActionsQuery(project.project.key);
  const { archive, dialog: archiveDialog } = useArchiveAction(project);
  const restoreIssue = useRestoreIssue(project.project.key);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<ActionDef | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enabling/revoking the public link refetches the issue so its shareToken and
  // shareExtended (which the dialog reads) stay in sync. The same call creates the
  // link and flips how much a live one exposes.
  async function share(extended: boolean) {
    const { token } = await api.enableIssueShare(issue.id, extended);
    await qc.invalidateQueries({ queryKey: qk.issue(issue.id) });
    return token;
  }
  async function disableShare() {
    await api.disableIssueShare(issue.id);
    await qc.invalidateQueries({ queryKey: qk.issue(issue.id) });
  }

  // Manual actions whose condition matches this issue, applied as one patch.
  // Applying one is a issue edit; Copy Prompt only reads the issue and is always
  // available, so the block always renders.
  const issueActions = canEdit ? matchedActions(actionsQuery.data ?? [], project, issue) : [];

  async function copyPrompt() {
    await navigator.clipboard.writeText(buildIssuePrompt(issue, project, session?.user));
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  // The issue's short identifier link (/IAP-62) redirects to the canonical page URL.
  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/${issue.identifier}`);
    toast.success(t('shortLinkCopied'));
  }

  async function copyBranch() {
    await navigator.clipboard.writeText(buildIssueBranchName(issue, session?.user));
    toast.success(t('branchCopied'));
  }

  // In the panel header the action buttons sit next to the size-7 expand/close
  // buttons, so they match that size; the row uses the roomier size.
  const btnSize = variant === 'header' ? 'icon-xs' : 'icon-sm';

  const buttons = (
    <div className={variant === 'header' ? 'flex items-center gap-0.5' : 'flex flex-wrap gap-1.5'}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={btnSize}
            className="text-muted-foreground hover:text-foreground"
            onClick={copyLink}
          >
            <Share2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('copyShortLink')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={btnSize}
            className="text-muted-foreground hover:text-foreground"
            onClick={copyBranch}
          >
            <GitBranch className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('copyBranch')}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={btnSize}
            className="text-muted-foreground hover:text-foreground"
            onClick={copyPrompt}
          >
            {copied ? (
              <Check className="size-4 text-green-500" />
            ) : (
              <ClipboardCopy className="size-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? t('copied') : t('copyPrompt')}</TooltipContent>
      </Tooltip>
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={btnSize}
              className={
                issue.shareToken ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }
              onClick={() => setSharing(true)}
            >
              <Globe className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {issue.shareToken ? t('sharedPublicly') : t('sharePublicly')}
          </TooltipContent>
        </Tooltip>
      )}
      {issueActions.map((a) => {
        const Icon = actionIcon(a.icon);
        return (
          <Tooltip key={a.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={btnSize}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setConfirmingAction(a)}
              >
                <Icon className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{a.name}</TooltipContent>
          </Tooltip>
        );
      })}
      {canEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={btnSize}
              className="text-muted-foreground hover:text-foreground"
              onClick={() => (issue.archivedAt ? restoreIssue.mutate(issue.id) : archive(issue))}
            >
              {issue.archivedAt ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{issue.archivedAt ? t('restore') : t('archive')}</TooltipContent>
        </Tooltip>
      )}
      {canDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={btnSize}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('delete')}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  return (
    <>
      {variant === 'header' ? buttons : <div className="mb-3 flex justify-end px-1">{buttons}</div>}

      {confirmingDelete && (
        <DeleteIssueDialog
          project={project}
          issue={issue}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={onDeleted}
        />
      )}

      {archiveDialog}

      {confirmingAction && (
        <ApplyActionDialog
          project={project}
          issue={issue}
          action={confirmingAction}
          onClose={() => setConfirmingAction(null)}
        />
      )}

      <ShareDialog
        open={sharing}
        onOpenChange={setSharing}
        title={t('shareIssue')}
        token={issue.shareToken}
        extended={issue.shareExtended}
        enable={share}
        disable={disableShare}
        pathForToken={shareIssuePath}
      />
    </>
  );
}
