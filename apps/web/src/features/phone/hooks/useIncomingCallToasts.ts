import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { usePhoneEventsQuery } from '../services/phone.service';

// Rinkel's event names for a call coming in. Everything else is still recorded,
// but only the ring is worth interrupting someone for. The documented payload is
// loose, so both the camelCase and the dotted spelling are accepted.
const INCOMING = new Set(['incomingCall', 'call.incoming', 'callStart', 'call.started']);

// Announces calls that reached the webhook endpoint after the page opened. The
// first answer only sets the watermark, so opening the page never replays history.
export function useIncomingCallToasts(projectKey: string, enabled: boolean) {
  const [since, setSince] = useState(0);
  const seeded = useRef(false);
  const queryClient = useQueryClient();
  const { data } = usePhoneEventsQuery(projectKey, since, enabled);

  useEffect(() => {
    if (!data) return;

    if (!seeded.current) {
      seeded.current = true;
      if (data.length > 0) setSince(data[data.length - 1].id);
      return;
    }
    if (data.length === 0) return;

    for (const event of data) {
      if (!INCOMING.has(event.event)) continue;
      toast('Incoming call', {
        description: event.externalNumber ?? 'Number withheld',
        duration: 10_000,
      });
    }
    setSince(data[data.length - 1].id);
    void queryClient.invalidateQueries({ queryKey: ['phoneCalls', projectKey] });
  }, [data, projectKey, queryClient]);
}
