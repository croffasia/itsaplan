import { Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { AgentFormValue } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { useTranslations } from 'next-intl';

// What starts a run: a mention in a comment, or being made an issue's delegate. The
// delegation delay only applies to the second, so it is shown with it.
export default function AgentTriggersSection({
  open,
  onOpenChange,
  value,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
}) {
  const t = useTranslations('settings.agents');
  const enabled = [value.triggerOnMention, value.triggerOnAssign].filter(Boolean).length;

  return (
    <AgentFormSection
      id="triggers"
      open={open}
      onOpenChange={onOpenChange}
      icon={Zap}
      title={t('triggers')}
      hint={t('triggersHint')}
      headerRight={`${enabled} / 2`}
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
        <div className="flex items-center justify-between gap-2 border-s ps-3">
          <span>
            <label htmlFor="agent-delegation-delay" className="text-sm">
              {t('delegationDelay')}
            </label>
            <span className="block text-xs text-muted-foreground">{t('delegationDelayHint')}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Input
              id="agent-delegation-delay"
              type="number"
              step="1"
              min="0"
              max="1440"
              className="w-20"
              value={value.delegationDelayMin}
              onChange={(e) => onChange({ delegationDelayMin: e.target.value })}
            />
            <span className="text-xs text-muted-foreground">{t('minutes')}</span>
          </div>
        </div>
      )}
    </AgentFormSection>
  );
}
