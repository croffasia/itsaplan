import { useState } from 'react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import type { Column } from '@/lib/api/endpoints/columns';
import type {
  AgentSchedule,
  AgentScheduleInput,
  AgentScheduleType,
} from '@/lib/api/endpoints/agentSchedules';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { delaySecFromMinutes } from '@/utils/runDelay';
import { parseScheduleInput } from '../../utils/cronSchedule';
import { SettingsScheduleField } from './SettingsScheduleField';
import { SettingsScheduleInput } from './SettingsScheduleInput';
import { SettingsScheduleRunnerHint } from './SettingsScheduleRunnerHint';
import { SettingsScheduleStatusFields } from './SettingsScheduleStatusFields';
import { SettingsScheduleTaskField } from './SettingsScheduleTaskField';
import { SettingsScheduleTypeField } from './SettingsScheduleTypeField';
import { useTranslations } from 'next-intl';

export function SettingsScheduleDialog({
  projectKey,
  agents,
  columns,
  initial,
  saving,
  onSave,
  onClose,
}: {
  projectKey: string;
  agents: AiAgent[];
  columns: Column[];
  initial?: AgentSchedule;
  saving: boolean;
  onSave: (value: AgentScheduleInput) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('settings.schedules');
  const tCommon = useTranslations('common');
  const tAgents = useTranslations('teams.agents');
  const [agentId, setAgentId] = useState(String(initial?.agentId ?? agents[0]?.id ?? ''));
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<AgentScheduleType>(initial?.type ?? 'cron');
  const [prompt, setPrompt] = useState(initial?.prompt ?? '');
  const [scheduleInput, setScheduleInput] = useState(initial?.cron ?? 'Every day at 9:00 AM');
  const [columnId, setColumnId] = useState(String(initial?.columnId ?? columns[0]?.id ?? ''));
  const [delayMin, setDelayMin] = useState(String(Math.round((initial?.delaySec ?? 0) / 60)));
  const selectedAgent = agents.find((a) => String(a.id) === agentId) ?? null;
  const isCron = type === 'cron';
  const isStatus = type === 'status';
  const parsedSchedule = parseScheduleInput(scheduleInput);
  // A schedule of a type the hosted build added, still listed on an instance without
  // it, saves with no trigger fields.
  const isValid =
    Number(agentId) > 0 &&
    name.trim().length > 0 &&
    name.trim().length <= 120 &&
    prompt.trim().length <= 20_000 &&
    (isCron
      ? prompt.trim().length > 0 && scheduleInput.length <= 120 && parsedSchedule.ok
      : !isStatus || Number(columnId) > 0);

  async function submit() {
    if (!isValid) return;
    const value: AgentScheduleInput = {
      agentId: Number(agentId),
      name: name.trim(),
      prompt: prompt.trim(),
      status: initial?.status ?? 'active',
      ...(initial ? {} : { type }),
    };
    if (isCron) {
      if (parsedSchedule.ok) await onSave({ ...value, cron: parsedSchedule.cron });
    } else if (isStatus) {
      await onSave({
        ...value,
        columnId: Number(columnId),
        delaySec: delaySecFromMinutes(delayMin),
      });
    } else {
      await onSave(value);
    }
  }

  const actionLabel = initial ? t('save') : t('create');
  const pendingLabel = initial ? tCommon('saving') : t('creating');

  return (
    <Modal
      title={initial ? t('editTitle') : t('newTitle')}
      description={t('dialogDescription')}
      scope={projectKey}
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
          <SettingsScheduleField htmlFor="schedule-name" label={tCommon('name')}>
            <Input
              id="schedule-name"
              autoFocus
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </SettingsScheduleField>
          <SettingsScheduleField htmlFor="schedule-agent" label={t('agent')}>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="schedule-agent" className="w-full" aria-required="true">
                <SelectValue placeholder={t('selectAgent')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={String(agent.id)}>
                    {agent.name}
                    <span className="text-xs text-muted-foreground">
                      {tAgents(`kindLabel.${agent.kind}`)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsScheduleField>
        </div>

        {selectedAgent?.kind === 'external' && <SettingsScheduleRunnerHint agent={selectedAgent} />}

        {!initial && <SettingsScheduleTypeField value={type} onChange={setType} />}

        <SettingsScheduleTaskField optional={!isCron} value={prompt} onChange={setPrompt} />

        <div className="border-t border-border/50 pt-4">
          {isStatus && (
            <SettingsScheduleStatusFields
              columns={columns}
              columnId={columnId}
              onColumnChange={setColumnId}
              delayMin={delayMin}
              onDelayChange={setDelayMin}
            />
          )}
          {isCron && (
            <SettingsScheduleField htmlFor="schedule-input" label={t('scheduleUtc')}>
              <SettingsScheduleInput
                id="schedule-input"
                value={scheduleInput}
                onChange={setScheduleInput}
              />
            </SettingsScheduleField>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!isValid || saving}>
            {saving ? pendingLabel : actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
