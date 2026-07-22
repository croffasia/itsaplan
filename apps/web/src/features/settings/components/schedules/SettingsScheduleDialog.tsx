import { useState } from 'react';
import type { AgentSchedule, AgentScheduleInput, AiAgent } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
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
import { Textarea } from '@/components/ui/textarea';
import { parseScheduleInput } from '../../utils/cronSchedule';
import { SettingsScheduleInput } from './SettingsScheduleInput';

export function SettingsScheduleDialog({
  projectKey,
  agents,
  initial,
  saving,
  onSave,
  onClose,
}: {
  projectKey: string;
  agents: AiAgent[];
  initial?: AgentSchedule;
  saving: boolean;
  onSave: (value: AgentScheduleInput) => Promise<void>;
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState(String(initial?.agentId ?? agents[0]?.id ?? ''));
  const [name, setName] = useState(initial?.name ?? '');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [scheduleInput, setScheduleInput] = useState(initial?.cron ?? 'Every day at 9:00 AM');
  const parsedSchedule = parseScheduleInput(scheduleInput);
  const isValid =
    Number(agentId) > 0 &&
    name.trim().length > 0 &&
    name.trim().length <= 120 &&
    prompt.trim().length > 0 &&
    prompt.trim().length <= 20_000 &&
    scheduleInput.length <= 120 &&
    parsedSchedule.ok;

  async function submit() {
    if (!isValid || !parsedSchedule.ok) return;
    await onSave({
      agentId: Number(agentId),
      name: name.trim(),
      prompt: prompt.trim(),
      cron: parsedSchedule.cron,
      status: initial?.status ?? 'active',
    });
  }

  const actionLabel = initial ? 'Save schedule' : 'Create schedule';
  const pendingLabel = initial ? 'Saving…' : 'Creating…';

  return (
    <Modal
      title={initial ? 'Edit schedule' : 'New schedule'}
      description="Choose an agent, describe the task, and set when it should run."
      projectKey={projectKey}
      onClose={onClose}
      wide
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="schedule-name" label="Name">
            <Input
              id="schedule-name"
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Daily task review"
            />
          </Field>
          <Field htmlFor="schedule-agent" label="Agent">
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="schedule-agent" className="w-full" aria-required="true">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field htmlFor="schedule-task" label="Task">
          <Textarea
            id="schedule-task"
            required
            maxLength={20_000}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Review open tasks and update anything that needs attention."
            className="min-h-32 resize-y"
          />
          <p className="text-xs text-muted-foreground">
            The agent receives this task on every run.
          </p>
        </Field>

        <div className="border-t border-border/50 pt-4">
          <Field htmlFor="schedule-input" label="Schedule (UTC)">
            <SettingsScheduleInput
              id="schedule-input"
              value={scheduleInput}
              onChange={setScheduleInput}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || saving}>
            {saving ? pendingLabel : actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
