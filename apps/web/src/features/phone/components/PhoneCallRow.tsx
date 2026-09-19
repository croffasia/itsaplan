'use client';

import Link from 'next/link';
import { PhoneIncoming, PhoneOutgoing, StickyNote } from 'lucide-react';
import { api, type PhoneCall } from '@/lib/api';
import { crmCustomerPath } from '@/utils/paths';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import PhoneAudioButton from './PhoneAudioButton';
import PhoneCallActions from './PhoneCallActions';
import { callerLabel, formatDuration, MISSED_REASONS, STATUS_LABELS } from '../utils/phone';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' {
  if (status === 'ANSWERED') return 'default';
  if (status === 'MISSED') return 'destructive';
  return 'secondary';
}

export default function PhoneCallRow({
  projectKey,
  call,
  canEdit,
  canDial,
  onNote,
  onBlock,
  onDial,
}: {
  projectKey: string;
  call: PhoneCall;
  canEdit: boolean;
  canDial: boolean;
  onNote: (call: PhoneCall) => void;
  onBlock: (call: PhoneCall) => void;
  onDial: (call: PhoneCall) => void;
}) {
  const Icon = call.direction === 'inbound' ? PhoneIncoming : PhoneOutgoing;
  const reason = call.missedReason ? MISSED_REASONS[call.missedReason] : null;

  return (
    <TableRow>
      <TableCell className="px-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{callerLabel(call)}</span>
              {call.blocked && <Badge variant="destructive">Blocked</Badge>}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {call.contactName && call.externalNumber && <span>{call.externalNumber}</span>}
              {call.crmCustomerId && (
                <Link
                  href={crmCustomerPath(projectKey, call.crmCustomerId)}
                  className="truncate underline underline-offset-2 hover:text-foreground"
                >
                  {call.crmCustomerName}
                </Link>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {new Date(call.date).toLocaleString()}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {call.internalLabel ?? call.internalNumber ?? '—'}
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(call.status)}>
          {STATUS_LABELS[call.status] ?? call.status}
        </Badge>
        {reason && <span className="ml-2 text-xs text-muted-foreground">{reason}</span>}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDuration(call.duration)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{call.userName ?? '—'}</TableCell>
      <TableCell className="px-3">
        <div className="flex items-center justify-end gap-1">
          {call.hasNotes && <StickyNote className="size-4 text-muted-foreground" />}
          {call.voicemailId && (
            <PhoneAudioButton
              label={call.voicemailNew ? 'New voicemail' : 'Voicemail'}
              loadUrl={() => api.getPhoneVoicemailUrl(projectKey, call.voicemailId!)}
            />
          )}
          {call.recordingId && (
            <PhoneAudioButton
              label="Recording"
              loadUrl={() => api.getPhoneRecordingUrl(projectKey, call.recordingId!)}
            />
          )}
          <PhoneCallActions
            call={call}
            canEdit={canEdit}
            canDial={canDial}
            onNote={() => onNote(call)}
            onBlock={() => onBlock(call)}
            onDial={() => onDial(call)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
