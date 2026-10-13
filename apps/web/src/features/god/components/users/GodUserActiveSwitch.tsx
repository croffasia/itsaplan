'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { InstanceUser } from '@/lib/api/endpoints/god';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import OnOffStatus from '@/components/common/fields/OnOffStatus';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSetInstanceUserActive } from '../../services/god.service';

// Whether the account may sign in. Turning it off asks first, since it signs the person
// out at once; turning it back on does not. An account god cannot switch shows its state.
export default function GodUserActiveSwitch({ user }: { user: InstanceUser }) {
  const t = useTranslations('god.users');
  const setActive = useSetInstanceUserActive();
  const [confirming, setConfirming] = useState(false);
  const label = t('activeAria', { email: user.email });

  if (user.activeLock) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <OnOffStatus on={user.active}>
            {t(user.active ? 'activeState.on' : 'activeState.off')}
          </OnOffStatus>
        </TooltipTrigger>
        <TooltipContent>{t(`activeLock.${user.activeLock}`)}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Switch
        checked={user.active}
        disabled={setActive.isPending}
        aria-label={label}
        onCheckedChange={(on) => {
          if (on) setActive.mutate({ userId: user.id, active: true });
          else setConfirming(true);
        }}
      />
      {confirming && (
        <ConfirmDialog
          title={t('deactivateTitle', { email: user.email })}
          confirmLabel={t('deactivateConfirm')}
          onConfirm={async () => {
            await setActive.mutateAsync({ userId: user.id, active: false });
            setConfirming(false);
          }}
          onClose={() => setConfirming(false)}
        >
          <p className="text-sm text-muted-foreground">{t('deactivateBody')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
