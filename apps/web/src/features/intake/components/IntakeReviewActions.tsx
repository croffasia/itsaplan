'use client';

import { useState } from 'react';
import { Check, Clock, Copy, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Assignee } from '@/lib/api/endpoints/projects';
import type { AcceptIntakeInput, IntakeRequest } from '@/lib/api/endpoints/intake';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = null | 'accept' | 'decline' | 'snooze' | 'duplicate';

export default function IntakeReviewActions({
  request,
  assignees,
  onAccept,
  onDecline,
  onSnooze,
  onDuplicate,
  busy,
}: {
  request: IntakeRequest;
  assignees: Assignee[];
  onAccept: (input: AcceptIntakeInput) => Promise<unknown>;
  onDecline: (reason: string) => Promise<unknown>;
  onSnooze: (until: string) => Promise<unknown>;
  onDuplicate: (issueId: number) => Promise<unknown>;
  busy: boolean;
}) {
  const t = useTranslations('intake');
  const [mode, setMode] = useState<Mode>(null);
  const [assigneeUserId, setAssigneeUserId] = useState<string>('none');
  const [dueDate, setDueDate] = useState('');
  const [reason, setReason] = useState('');
  const [snoozeDate, setSnoozeDate] = useState('');
  const [duplicateIssueId, setDuplicateIssueId] = useState('');

  if (request.status !== 'pending' && request.status !== 'snoozed') return null;

  const humanAssignees = assignees.filter((a) => a.kind === 'member');

  const handleAccept = async () => {
    await onAccept({
      assigneeUserId: assigneeUserId === 'none' ? null : assigneeUserId,
      dueDate: dueDate || null,
    });
    toast.success(t('toast.accepted'));
    setMode(null);
  };

  const handleDecline = async () => {
    await onDecline(reason.trim());
    toast.success(t('toast.declined'));
    setReason('');
    setMode(null);
  };

  const handleSnooze = async () => {
    if (!snoozeDate) return;
    await onSnooze(snoozeDate);
    toast.success(t('toast.snoozed'));
    setSnoozeDate('');
    setMode(null);
  };

  const handleDuplicate = async () => {
    const id = Number(duplicateIssueId);
    if (!Number.isInteger(id) || id < 1) return;
    await onDuplicate(id);
    toast.success(t('toast.duplicate'));
    setDuplicateIssueId('');
    setMode(null);
  };

  return (
    <div className="space-y-3 border-b pb-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setMode(mode === 'accept' ? null : 'accept')}>
          <Check className="me-1.5 size-3.5" />
          {t('actions.accept')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode(mode === 'decline' ? null : 'decline')}
        >
          <X className="me-1.5 size-3.5" />
          {t('actions.decline')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode(mode === 'snooze' ? null : 'snooze')}
        >
          <Clock className="me-1.5 size-3.5" />
          {t('actions.snooze')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setMode(mode === 'duplicate' ? null : 'duplicate')}
        >
          <Copy className="me-1.5 size-3.5" />
          {t('actions.duplicate')}
        </Button>
      </div>

      {mode === 'accept' && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-3">
          <div className="min-w-40 flex-1 space-y-1">
            <span className="text-xs text-muted-foreground">{t('fields.assignee')}</span>
            <Select value={assigneeUserId} onValueChange={setAssigneeUserId}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('fields.unassigned')}</SelectItem>
                {humanAssignees.map((a) => (
                  <SelectItem key={a.userId} value={a.userId}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">{t('fields.dueDate')}</span>
            <Input
              type="date"
              className="h-8 w-40"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={busy} onClick={() => void handleAccept()}>
            {t('actions.confirmAccept')}
          </Button>
        </div>
      )}

      {mode === 'decline' && (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('fields.declineReasonPlaceholder')}
            maxLength={500}
            dir="auto"
          />
          <Button
            size="sm"
            variant="destructive"
            disabled={busy}
            onClick={() => void handleDecline()}
          >
            {t('actions.confirmDecline')}
          </Button>
        </div>
      )}

      {mode === 'snooze' && (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Input
            type="date"
            value={snoozeDate}
            onChange={(e) => setSnoozeDate(e.target.value)}
            className="w-44"
          />
          <Button size="sm" disabled={busy || !snoozeDate} onClick={() => void handleSnooze()}>
            {t('actions.confirmSnooze')}
          </Button>
        </div>
      )}

      {mode === 'duplicate' && (
        <div className="flex items-center gap-2 rounded-md border p-3">
          <Input
            type="number"
            min={1}
            value={duplicateIssueId}
            onChange={(e) => setDuplicateIssueId(e.target.value)}
            placeholder={t('fields.duplicateIssueIdPlaceholder')}
            dir="ltr"
          />
          <Button
            size="sm"
            disabled={busy || !duplicateIssueId}
            onClick={() => void handleDuplicate()}
          >
            {t('actions.confirmDuplicate')}
          </Button>
        </div>
      )}
    </div>
  );
}
