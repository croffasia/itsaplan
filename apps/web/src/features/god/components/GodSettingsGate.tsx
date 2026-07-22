'use client';

import { Fragment, type ReactNode } from 'react';
import GodSectionPage from './GodSectionPage';

// Holds a settings page back until its stored state has loaded, then renders the form
// keyed on that state: a save replaces the cache entry, so the key changes and the
// form remounts with fresh initial values instead of a stale "dirty" comparison.
export default function GodSettingsGate<T>({
  slug,
  data,
  children,
}: {
  slug: string;
  data: T | undefined;
  children: (data: T) => ReactNode;
}) {
  if (!data) {
    return (
      <GodSectionPage slug={slug}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </GodSectionPage>
    );
  }
  return <Fragment key={JSON.stringify(data)}>{children(data)}</Fragment>;
}
