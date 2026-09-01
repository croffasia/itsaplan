'use client';

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react';
import { useFormatter, useNow } from 'next-intl';

const UPDATE_INTERVAL_MS = 60_000;

interface RelativeTimeClock {
  scheduledNow: Date;
  live: boolean;
}

const RelativeTimeNowCtx = createContext<RelativeTimeClock | null>(null);

// useSyncExternalStore gives server rendering a stable request-time snapshot and
// switches to the wall clock as soon as the client owns the tree. There is no
// external store to subscribe to: useNow below supplies the minute refresh.
const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function RelativeTimeProvider({ children }: { children: ReactNode }) {
  const scheduledNow = useNow({ updateInterval: UPDATE_INTERVAL_MS });
  const live = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);

  return (
    <RelativeTimeNowCtx.Provider value={{ scheduledNow, live }}>
      {children}
    </RelativeTimeNowCtx.Provider>
  );
}

export function useRelativeTime(): (value: Date | string) => string {
  const clock = useContext(RelativeTimeNowCtx);
  const format = useFormatter();
  if (!clock) throw new Error('useRelativeTime must be used inside RelativeTimeProvider');

  return (value: Date | string) => {
    // A feed update can render between minute ticks. Read the wall clock during
    // that render so a newly-created event is never compared with the older tick.
    const referenceNow = clock.live ? new Date() : clock.scheduledNow;
    return format.relativeTime(typeof value === 'string' ? new Date(value) : value, referenceNow);
  };
}
