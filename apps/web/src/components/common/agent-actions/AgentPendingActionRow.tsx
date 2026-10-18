'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PendingAction } from '@/lib/api/endpoints/agent-actions';
import { useDecidePendingAction } from '@/services/agentActions.service';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// One held tool call of an agent: what it asked to do and, while it waits, the
// buttons that decide it. A rejection asks for the reason first.
export function AgentPendingActionRow({ action }: { action: PendingAction }) {
  const t = useTranslations('teams.agentActions');
  const relativeTime = useRelativeTime();
  const decide = useDecidePendingAction();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-2 px-4 py-3 text-xs">
      <div className="flex items-center gap-2">
        <Badge variant={action.status === 'pending' ? 'secondary' : 'outline'}>
          {t(`status.${action.status}`)}
        </Badge>
        <span className="font-medium">{action.agentName}</span>
        <code className="truncate text-muted-foreground">{action.tool}</code>
        <span className="ms-auto shrink-0 text-muted-foreground">
          {relativeTime(action.createdAt)}
        </span>
      </div>
      <pre
        dir="ltr"
        className="max-h-32 overflow-auto rounded bg-muted p-2 text-[11px] whitespace-pre-wrap"
      >
        {JSON.stringify(action.args, null, 2)}
      </pre>
      {action.reason && <p className="text-muted-foreground">{action.reason}</p>}
      {action.status === 'failed' && action.result && (
        <p className="text-destructive">{action.result}</p>
      )}
      {action.status === 'pending' &&
        (rejecting ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              decide.mutate({ actionId: action.id, reject: reason.trim() });
            }}
          >
            <Input
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              aria-label={t('reason')}
              className="h-8"
            />
            <Button type="submit" size="sm" disabled={!reason.trim() || decide.isPending}>
              {t('reject')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              {t('cancel')}
            </Button>
          </form>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ actionId: action.id })}
            >
              <Check />
              {t('approve')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejecting(true)}>
              <X />
              {t('reject')}
            </Button>
          </div>
        ))}
    </div>
  );
}
