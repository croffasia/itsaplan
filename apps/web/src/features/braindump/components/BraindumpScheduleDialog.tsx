import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAiAgentsQuery } from '@/services/aiAgents.service';

// Picks the agent and the cron a dump is handed to. The expression is validated by
// the API (croner), so this only collects it.
export default function BraindumpScheduleDialog({
  projectKey,
  open,
  onOpenChange,
  onConfirm,
}: {
  projectKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: { agentId: number; cron: string }) => void;
}) {
  const agentsQuery = useAiAgentsQuery(projectKey);
  const agents = (agentsQuery.data ?? []).filter((agent) => agent.kind === 'internal');
  const [agentId, setAgentId] = useState<string>('');
  const [cron, setCron] = useState('0 9 * * *');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule this dump</DialogTitle>
          <DialogDescription>
            The text becomes the prompt an agent runs on this schedule. Times are UTC.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="braindump-schedule-agent">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="braindump-schedule-agent" className="w-full">
                <SelectValue
                  placeholder={agents.length === 0 ? 'No internal agents yet' : 'Pick an agent'}
                />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="braindump-schedule-cron">Cron expression</Label>
            <Input
              id="braindump-schedule-cron"
              value={cron}
              onChange={(event) => setCron(event.target.value)}
              placeholder="0 9 * * *"
            />
            <p className="text-xs text-muted-foreground">
              Five fields: minute, hour, day of month, month, day of week.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={agentId.length === 0 || cron.trim().length === 0}
            onClick={() => onConfirm({ agentId: Number(agentId), cron: cron.trim() })}
          >
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
