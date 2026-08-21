import { Fragment } from 'react';
import { Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { isMemberField } from '@/utils/memberFields';
import { useProjectQuery } from '@/services/projects.service';
import type { AgentFormValue } from '../../utils/agentForm';
import { AgentDelayInput } from './AgentDelayInput';
import { AgentFormSection } from './AgentFormSection';
import { useTranslations } from 'next-intl';

// What starts a run: a mention in a comment, being made an issue's delegate, or being
// set into a member custom field that holds agents. Every trigger but the mention
// carries the wait before the run starts, so one field can start at once while
// another leaves time to edit the issue.
export default function AgentTriggersSection({
  open,
  onOpenChange,
  projectKey,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectKey: string;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
}) {
  const t = useTranslations('settings.agents');
  const customFields = useProjectQuery(projectKey).data?.customFields ?? [];
  const memberFields = customFields.filter((f) => isMemberField(f) && f.memberScope !== 'humans');
  const enabled =
    [value.triggerOnMention, value.triggerOnAssign].filter(Boolean).length +
    memberFields.filter((f) => value.fieldTriggers.some((tr) => tr.fieldId === f.id)).length;

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
      id="triggers"
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
      {memberFields.map((field) => {
        const trigger = value.fieldTriggers.find((tr) => tr.fieldId === field.id);
        return (
          <Fragment key={field.id}>
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span>
                <span className="text-sm">{t('onFieldSet', { field: field.name })}</span>
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
