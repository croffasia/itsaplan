import { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { AgentSchedule, AgentScheduleRun } from '@/lib/api';
import { formatDateTime } from '@/utils/dates';
import { useAgentScheduleRuns } from '@/services/agentSchedules.service';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export function SettingsScheduleRunsSheet({
  projectKey,
  schedule,
  onClose,
}: {
  projectKey: string;
  schedule: AgentSchedule | null;
  onClose: () => void;
}) {
  const query = useAgentScheduleRuns(projectKey, schedule?.id ?? null);
  return (
    <Sheet open={schedule != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Run history</SheetTitle>
          <SheetDescription>{schedule?.name}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {query.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading runs…</p>
          ) : query.data?.length ? (
            <div className="divide-y divide-border/50">
              {query.data.map((run) => (
                <RunRow key={run.id} run={run} />
              ))}
            </div>
          ) : (
            <p className="p-4 text-sm text-muted-foreground">No runs yet.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RunRow({ run }: { run: AgentScheduleRun }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const variant =
    run.status === 'failed' ? 'destructive' : run.status === 'success' ? 'secondary' : 'outline';
  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs hover:bg-accent/50"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <Badge variant={variant}>{run.status}</Badge>
        <span className="capitalize">{run.trigger}</span>
        <span className="ml-auto text-muted-foreground">{formatDateTime(run.createdAt)}</span>
      </button>
      {open && (
        <div id={contentId} className="space-y-3 px-4 pb-4 text-xs">
          <Block label="Task" value={run.prompt} />
          <Block
            label={run.lastError ? 'Error' : 'Result'}
            value={run.lastError ?? run.output ?? 'No output'}
          />
        </div>
      )}
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-sans whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}
