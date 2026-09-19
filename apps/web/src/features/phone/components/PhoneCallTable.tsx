'use client';

import type { PhoneCall } from '@/lib/api';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PhoneCallRow from './PhoneCallRow';

export default function PhoneCallTable({
  projectKey,
  calls,
  canEdit,
  canDial,
  onNote,
  onBlock,
  onDial,
}: {
  projectKey: string;
  calls: PhoneCall[];
  canEdit: boolean;
  canDial: boolean;
  onNote: (call: PhoneCall) => void;
  onBlock: (call: PhoneCall) => void;
  onDial: (call: PhoneCall) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3 text-xs text-muted-foreground">Caller</TableHead>
            <TableHead className="text-xs text-muted-foreground">When</TableHead>
            <TableHead className="text-xs text-muted-foreground">Number</TableHead>
            <TableHead className="text-xs text-muted-foreground">Status</TableHead>
            <TableHead className="text-xs text-muted-foreground">Duration</TableHead>
            <TableHead className="text-xs text-muted-foreground">Handled by</TableHead>
            <TableHead className="px-3 text-right text-xs text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <PhoneCallRow
              key={call.id}
              projectKey={projectKey}
              call={call}
              canEdit={canEdit}
              canDial={canDial}
              onNote={onNote}
              onBlock={onBlock}
              onDial={onDial}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
