import { Shield } from 'lucide-react';
import type { Role } from '@/lib/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentFormValue } from '../../utils/agentForm';
import { AgentFormSection } from './AgentFormSection';
import { useTranslations } from 'next-intl';

// Select value while the roles are still loading and no role can be named yet.
const NO_ROLE_VALUE = '__none__';

// What an external agent may do in the project: the role its requests act under and
// whose runs its runner is served.
export default function AgentAccessSection({
  open,
  onOpenChange,
  value,
  onChange,
  roles,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: AgentFormValue;
  onChange: (patch: Partial<AgentFormValue>) => void;
  roles: Role[];
}) {
  const t = useTranslations('settings.agents');

  // The server resolves a missing role to the project's default one, so the select
  // shows that default rather than sitting empty.
  const defaultRole = roles.find((r) => r.isDefault) ?? roles[0];
  const effectiveRoleId = value.roleId ?? defaultRole?.id ?? null;
  const selectedRoleValue = effectiveRoleId != null ? String(effectiveRoleId) : NO_ROLE_VALUE;

  return (
    <AgentFormSection
      id="access"
      open={open}
      onOpenChange={onOpenChange}
      icon={Shield}
      title={t('access')}
      hint={t('accessHint')}
    >
      {/* Label and its hint stack on the left of the select, so the row reads as one
          setting instead of spilling onto a third line. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-sm font-medium">{t('role')}</span>
          <span className="block text-xs text-muted-foreground">{t('roleHintExternal')}</span>
        </div>
        {/* Keyed by the option set: the roles arrive after the first render, and a
            Select that mounted without them keeps showing an empty trigger. */}
        <Select
          key={roles.map((r) => r.id).join(',')}
          value={selectedRoleValue}
          onValueChange={(v) => onChange({ roleId: Number(v) })}
        >
          <SelectTrigger className="min-w-[150px]">
            <SelectValue placeholder={t('chooseRole')} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Who the agent takes work from is an access rule, not a runner setting: the
          runner just executes whatever it is handed. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="block text-sm font-medium">{t('runnerScope')}</span>
          <span className="block text-xs text-muted-foreground">
            {value.runnerScope === 'owner'
              ? t('runnerScopeOwnerHint')
              : t('runnerScopeProjectHint')}
          </span>
        </div>
        <Select
          value={value.runnerScope}
          onValueChange={(v) => onChange({ runnerScope: v as AgentFormValue['runnerScope'] })}
        >
          <SelectTrigger className="min-w-[150px]" aria-label={t('runnerScope')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="owner">{t('runnerScopeOwner')}</SelectItem>
            <SelectItem value="project">{t('runnerScopeProject')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </AgentFormSection>
  );
}
