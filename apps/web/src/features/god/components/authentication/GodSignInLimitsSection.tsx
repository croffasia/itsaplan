'use client';

import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import SettingsRow from '@/components/common/page/SettingsRow';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Input } from '@/components/ui/input';
import {
  MAX_AUTH_RATE_LIMIT,
  SIGN_IN_LIMITS,
  type GodPolicyForm,
} from '../../hooks/useGodPolicyForm';

export default function GodSignInLimitsSection({ policy }: { policy: GodPolicyForm }) {
  const t = useTranslations('god.authentication');

  return (
    <SettingsSection title={t('signInLimits')} description={t('signInLimitsHint')}>
      <SettingsCard className="divide-y divide-border/60">
        {SIGN_IN_LIMITS.map((limit) => (
          <SettingsRow
            key={limit}
            title={t(limit)}
            description={t(`${limit}Hint`)}
            note={
              policy.limitValid(limit)
                ? undefined
                : t('signInLimitInvalid', { max: MAX_AUTH_RATE_LIMIT })
            }
            control={
              <Input
                type="number"
                min={1}
                max={MAX_AUTH_RATE_LIMIT}
                step={1}
                inputMode="numeric"
                className="w-24"
                aria-label={t(limit)}
                aria-invalid={!policy.limitValid(limit)}
                value={policy.limits[limit]}
                disabled={policy.saving}
                onChange={(e) => policy.setLimit(limit, e.target.value)}
              />
            }
          />
        ))}
      </SettingsCard>
    </SettingsSection>
  );
}
