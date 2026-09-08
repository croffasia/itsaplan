import { Fragment } from 'react';
import { Zap } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import type { TeamProjectOption } from '@/lib/api/endpoints/teams';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import { getProject } from '@/lib/api/endpoints/projects';
import { qk } from '@/services/queryKeys';
import { Switch } from '@/components/ui/switch';
import { isMemberField } from '@/utils/memberFields';
import type { AgentFormValue } from '../../utils/agentForm';
import { AgentDelayInput } from './AgentDelayInput';
import { AgentFormSection } from './AgentFormSection';
import { useTranslations } from 'next-intl';

// A member field an agent can be set into, with the project it belongs to: an agent
// works in several projects of its team, and each has its own fields.
type ProjectField = { field: CustomField; project: TeamProjectOption };

// What starts a run: a mention in a comment, being made an issue's delegate, or being
// set into a member custom field that holds agents. Every trigger but the mention
// carries the wait before the run starts, so one field can start at once while
// another leaves time to edit the issue.
export default function AgentTriggersSection({
  open,
  onOpenChange,
  value,
  onChange,
  projects,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  // The projects of the team, of which the agent works in the ones it is attached to.
  // Only those carry fields it can be set into.
  projects: TeamProjectOption[];
}) {
  const t = useTranslations('teams.agents');
  const attached = projects.filter((project) => value.projectIds.includes(project.id));
  // One scaffold read per attached project. A project the reader has open is already
  // in the cache, so opening the editor usually fetches only the rest.
  const scaffolds = useQueries({
    queries: attached.map((project) => ({
      queryKey: qk.project(project.key),
      queryFn: () => getProject(project.key),
    })),
  });
  const memberFields: ProjectField[] = scaffolds.flatMap((scaffold, index) =>
    (scaffold.data?.customFields ?? [])
      .filter((field) => isMemberField(field) && field.memberScope !== 'humans')
      .map((field) => ({ field, project: attached[index] })),
  );

  const enabled =
    [value.triggerOnMention, value.triggerOnAssign].filter(Boolean).length +
    memberFields.filter((f) => value.fieldTriggers.some((tr) => tr.fieldId === f.field.id)).length;

  function toggleField(id: number, on: boolean) {
    onChange({
      fieldTriggers: on
        ? [...value.fieldTriggers, { fieldId: id, delayMin: '0' }]
        : value.fieldTriggers.filter((tr) => tr.fieldId !== id),
    });
  }

  function setFieldDelay(id: number, delayMin: string) {
    onChange({
      fieldTriggers: value.fieldTriggers.map((tr) =>
        tr.fieldId === id ? { ...tr, delayMin } : tr,
      ),
    });
  }

  return (
    <AgentFormSection
      open={open}
      onOpenChange={onOpenChange}
      icon={Zap}
      title={t('triggers')}
      hint={t('triggersHint')}
      headerRight={`${enabled} / ${2 + memberFields.length}`}
    >
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          <span className="text-sm">{t('onMention')}</span>
          <span className="block text-xs text-muted-foreground">{t('onMentionHint')}</span>
        </span>
        <Switch
          checked={value.triggerOnMention}
          onCheckedChange={(v) => onChange({ triggerOnMention: v })}
        />
      </label>
      <label className="flex cursor-pointer items-center justify-between gap-2">
        <span>
          <span className="text-sm">{t('onDelegation')}</span>
          <span className="block text-xs text-muted-foreground">{t('onDelegationHint')}</span>
        </span>
        <Switch
          checked={value.triggerOnAssign}
          onCheckedChange={(v) => onChange({ triggerOnAssign: v })}
        />
      </label>
      {value.triggerOnAssign && (
        <AgentDelayInput
          id="agent-delegation-delay"
          value={value.delegationDelayMin}
          onChange={(v) => onChange({ delegationDelayMin: v })}
        />
      )}
      {memberFields.map(({ field, project }) => {
        const trigger = value.fieldTriggers.find((tr) => tr.fieldId === field.id);
        return (
          <Fragment key={field.id}>
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span>
                <span className="text-sm">
                  {t('onFieldSet', { field: `${project.key} · ${field.name}` })}
                </span>
                <span className="block text-xs text-muted-foreground">{t('onFieldSetHint')}</span>
              </span>
              <Switch checked={trigger != null} onCheckedChange={(v) => toggleField(field.id, v)} />
            </label>
            {trigger && (
              <AgentDelayInput
                id={`agent-field-delay-${field.id}`}
                value={trigger.delayMin}
                onChange={(v) => setFieldDelay(field.id, v)}
              />
            )}
          </Fragment>
        );
      })}
    </AgentFormSection>
  );
}
