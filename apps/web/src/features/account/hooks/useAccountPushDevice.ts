'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/core/client';
import { listPushDevices, type PushDevice } from '@/lib/api/endpoints/push';
import {
  readPushBrowser,
  subscribeThisBrowser,
  unsubscribeThisBrowser,
  type PushBrowser,
} from '@/utils/webPush';
import { usePushConfigQuery } from '@/services/push.service';
import { qk } from '@/services/queryKeys';
import { setPushOnInThisBrowser } from '@/utils/browserNotifications';

type AccountPushState =
  'hidden' | 'loading' | 'unsupported' | 'unsupportedIos' | 'blocked' | 'off' | 'on';

// On while this browser holds a subscription the api keeps for the signed-in user.
function pushState(
  publicKey: string | null,
  browser: PushBrowser | undefined,
  devices: PushDevice[] | undefined,
): AccountPushState {
  if (!publicKey) return 'hidden';
  if (!browser) return 'loading';
  if (!browser.supported) return browser.ios ? 'unsupportedIos' : 'unsupported';
  if (browser.permission === 'denied') return 'blocked';
  if (!devices) return 'loading';
  const kept = devices.some((device) => device.endpoint === browser.endpoint);
  return browser.permission === 'granted' && kept ? 'on' : 'off';
}

// Push notifications in this browser. Hidden while the instance sends none.
export function useAccountPushDevice() {
  const t = useTranslations('account.preferences');
  const qc = useQueryClient();
  const { data: config } = usePushConfigQuery();
  const publicKey = config?.enabled ? config.publicKey : null;
  const browser = useQuery({
    queryKey: qk.pushBrowser,
    queryFn: () => readPushBrowser(publicKey!),
    enabled: publicKey !== null,
  });
  const devices = useQuery({
    queryKey: qk.pushDevices,
    queryFn: () => listPushDevices(),
    enabled: browser.data?.supported === true,
  });
  const [pending, setPending] = useState(false);
  const state = pushState(publicKey, browser.data, devices.data);
  const configLoaded = config !== undefined;

  // The flag the desktop notifications read follows the real subscription, so one the
  // browser revoked, one made with old keys, or push turned off on the instance clears it.
  useEffect(() => {
    if (configLoaded && state !== 'loading') setPushOnInThisBrowser(state === 'on');
  }, [configLoaded, state]);

  // A plain request rather than a mutation: the permission prompt has to open from the
  // tap itself, before anything is awaited.
  async function setOn(on: boolean) {
    if (!publicKey) return;
    setPending(true);
    try {
      if (on) await subscribeThisBrowser(publicKey);
      else await unsubscribeThisBrowser();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('pushNotificationsFailed'));
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.pushBrowser }),
        qc.invalidateQueries({ queryKey: qk.pushDevices }),
      ]);
      setPending(false);
    }
  }

  return { state, pending, setOn };
}
