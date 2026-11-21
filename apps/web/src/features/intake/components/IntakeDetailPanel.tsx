'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Paperclip, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Assignee } from '@/lib/api/endpoints/projects';
import { mediaUrl } from '@/lib/api/core/media';
import { issuePath } from '@/utils/paths';
import { useIntakeMutations, useIntakeRequestDetailQuery } from '@/services/intake.service';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import IntakeReviewActions from './IntakeReviewActions';

export default function IntakeDetailPanel({
  projectRef,
  projectKey,
  requestId,
  assignees,
  onDeleted,
}: {
  projectRef: string;
  projectKey: string;
  requestId: number;
  assignees: Assignee[];
  onDeleted: () => void;
}) {
  const t = useTranslations('intake');
  const { can } = usePermissions();
  const { data: detail, isLoading } = useIntakeRequestDetailQuery(requestId);
  const mutations = useIntakeMutations(projectRef);
  const [commentBody, setCommentBody] = useState('');

  if (isLoading || !detail) {
    return <div className="p-6 text-sm text-muted-foreground">{t('loading')}</div>;
  }

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    await mutations.addComment.mutateAsync({ requestId: detail.id, body: commentBody.trim() });
    setCommentBody('');
    toast.success(t('toast.commentAdded'));
  };

  const handleDelete = async () => {
    await mutations.remove.mutateAsync(detail.id);
    toast.success(t('toast.deleted'));
    onDeleted();
  };

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold" dir="auto">
            {detail.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{t(`status.${detail.status}`)}</Badge>
            <span>{detail.source}</span>
            {detail.externalId && (
              <span className="font-mono" dir="ltr">
                {detail.externalId}
              </span>
            )}
            {detail.submittedByName && <span dir="auto">{detail.submittedByName}</span>}
          </div>
        </div>
        {can('intake', 'delete') && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void handleDelete()}
            disabled={mutations.remove.isPending}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>

      {detail.acceptedIssue && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          {t('linked.accepted')}{' '}
          <Link
            href={issuePath(projectRef, detail.acceptedIssue.sequenceNumber)}
            className="font-medium underline"
          >
            {projectKey}-{detail.acceptedIssue.sequenceNumber} {detail.acceptedIssue.title}
          </Link>
        </div>
      )}

      {detail.duplicateOfIssue && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          {t('linked.duplicate')}{' '}
          <Link
            href={issuePath(projectRef, detail.duplicateOfIssue.sequenceNumber)}
            className="font-medium underline"
          >
            {projectKey}-{detail.duplicateOfIssue.sequenceNumber} {detail.duplicateOfIssue.title}
          </Link>
        </div>
      )}

      {detail.declineReason && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm" dir="auto">
          {t('linked.declineReason', { reason: detail.declineReason })}
        </div>
      )}

      {can('intake', 'edit') && (
        <IntakeReviewActions
          request={detail}
          assignees={assignees}
          busy={
            mutations.accept.isPending ||
            mutations.decline.isPending ||
            mutations.snooze.isPending ||
            mutations.duplicate.isPending
          }
          onAccept={(input) => mutations.accept.mutateAsync({ requestId: detail.id, input })}
          onDecline={(reason) => mutations.decline.mutateAsync({ requestId: detail.id, reason })}
          onSnooze={(until) => mutations.snooze.mutateAsync({ requestId: detail.id, until })}
          onDuplicate={(issueId) =>
            mutations.duplicate.mutateAsync({ requestId: detail.id, issueId })
          }
        />
      )}

      {detail.description && (
        <div className="text-sm whitespace-pre-wrap" dir="auto">
          {detail.description}
        </div>
      )}

      {detail.attachments.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">{t('sections.attachments')}</h3>
          <div className="flex flex-wrap gap-2">
            {detail.attachments.map((att) => (
              <a
                key={att.id}
                href={mediaUrl(att.url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs hover:bg-muted/50"
              >
                <Paperclip className="size-3" />
                <span>{att.filename}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <h3 className="text-xs font-medium text-muted-foreground">{t('sections.comments')}</h3>
        {detail.comments.map((c) => (
          <div key={c.id} className="rounded-md border p-3 text-sm">
            <div className="mb-1 text-xs font-medium text-muted-foreground" dir="auto">
              {c.actorName ?? t('someone')}
            </div>
            <div className="whitespace-pre-wrap" dir="auto">
              {c.body}
            </div>
          </div>
        ))}
        {can('intake', 'create') && (
          <form onSubmit={submitComment} className="space-y-2">
            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={t('fields.commentPlaceholder')}
              rows={2}
              dir="auto"
            />
            <Button
              size="sm"
              type="submit"
              disabled={mutations.addComment.isPending || !commentBody.trim()}
            >
              {t('actions.addComment')}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
