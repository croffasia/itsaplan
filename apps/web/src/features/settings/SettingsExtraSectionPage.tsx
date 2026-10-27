'use client';

import { useIsFetching } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { useSettingsSections } from '@/hooks/useSettingsNavGroups';

// A project settings section without a route of its own: one the hosted build adds. Its
// sections can depend on queries of their own, so a link straight to one waits for those
// to load before it calls the section unknown.
export default function SettingsExtraSectionPage({ slug }: { slug: string }) {
  const { project } = useShell();
  const Component = useSettingsSections().find((entry) => entry.slug === slug)?.Component;
  const loading = useIsFetching() > 0;
  if (!Component) {
    if (!project || loading) return null;
    notFound();
  }
  return <Component />;
}
