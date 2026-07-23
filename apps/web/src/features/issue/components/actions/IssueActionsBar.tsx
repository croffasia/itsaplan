import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Check, ClipboardCopy, Globe, Share2, Trash2 } from 'lucide-react';
import {
  api,
  type ActionDef,
  type ProjectDetail,
  type IssueDetail as IssueDetailRow,
} from '@/lib/api';
import { actionIcon } from '@/utils/actionIcons';
import { useActionsQuery } from '@/services/actions.service';
import { useArchiveIssue, useRestoreIssue } from '@/services/issues.service';
import { qk } from '@/services/queryKeys';
import { usePermissions } from '@/hooks/usePermissions';
import { ApplyActionDialog, DeleteIssueDialog, matchedActions } from './IssueActions';
import { buildIssuePrompt } from '../../utils/issuePrompt';
import { useSession } from '@/lib/auth-client';
import { shareIssuePath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ShareDialog from '@/components/common/share/ShareDialog';

// The issue detail Actions: the manual actions whose condition matches this
// issue, plus Copy Prompt and a delete button. Owns the delete/apply
// confirmations and the mutations they run. The 'section' variant is a standalone
// block; the 'header' variant is the bare button row placed in the side panel's
// header. The confirm dialogs render through a portal, so their position in the
// tree does not matter.
export default function IssueActionsBar({
  project,
  issue,
  hasSidebar,
  variant = 'section',
  onDeleted,
}: {
  project: ProjectDetail;
  issue: IssueDetailRow;
  // True when the host renders Properties in a sidebar, which the 'section'
  // variant follows with a bare right-aligned button row instead of a titled block.
  hasSidebar: boolean;
  // 'section' is the standalone block (page sidebar card / panel body). 'header'
  // renders just the action buttons inline, for the side-panel header row.
  variant?: 'section' | 'header';
  onDeleted?: () => void;
}) {
  const { can } = usePermissions();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const canEdit = can('work_items', 'edit');
  const canDelete = can('work_items', 'delete');
  const actionsQuery = useActionsQuery(project.project.key);
  const archiveIssue = useArchiveIssue(project.project.key);
  const restoreIssue = useRestoreIssue(project.project.key);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<ActionDef | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Enabling/revoking the public link refetches the issue so its shareToken (and
  // the dialog's state on reopen) stays in sync.
  async function enableShare() {
    const { token } = await api.enableIssueShare(issue.id);
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
    toast.success('Short link copied');
  }

  // In the panel header the action buttons sit next to the size-7 expand/close
  // buttons, so they match that size; the standalone block uses the roomier size.
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
        <TooltipContent>Copy short link</TooltipContent>
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
        <TooltipContent>{copied ? 'Copied!' : 'Copy Prompt'}</TooltipContent>
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
          <TooltipContent>{issue.shareToken ? 'Shared publicly' : 'Share publicly'}</TooltipContent>
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
              onClick={() =>
                issue.archivedAt ? restoreIssue.mutate(issue.id) : archiveIssue.mutate(issue.id)
              }
            >
              {issue.archivedAt ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{issue.archivedAt ? 'Restore issue' : 'Archive issue'}</TooltipContent>
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
          <TooltipContent>Delete issue</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  function layout() {
    if (variant === 'header') return buttons;
    // Above a Properties sidebar the actions are a bare button row: no card
    // border, no "Actions" heading, right-aligned.
    if (hasSidebar) return <div className="mb-3 flex justify-end px-1">{buttons}</div>;
    return (
      <div className="mt-6 border-t pt-5">
        <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Actions
        </h3>
        {buttons}
      </div>
    );
  }

  return (
    <>
      {layout()}

      {confirmingDelete && (
        <DeleteIssueDialog
          project={project}
          issue={issue}
          onClose={() => setConfirmingDelete(false)}
          onDeleted={onDeleted}
        />
      )}

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
        title="Share issue"
        token={issue.shareToken}
        enable={enableShare}
        disable={disableShare}
        pathForToken={shareIssuePath}
      />
    </>
  );
}
