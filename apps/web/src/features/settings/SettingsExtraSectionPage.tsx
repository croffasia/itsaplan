'use client';

import { useIsFetching } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { useShell } from '@/context/shellContext';
import { useProjectSections } from '@/hooks/useSettingsNavGroups';

// A project section without a route of its own: one the hosted build adds, at
// /settings/:section or, in the AI Team group, at /agents/:section. Its sections can depend
// on queries of their own, so a link straight to one waits for those to load before it
// calls the section unknown.
export default function SettingsExtraSectionPage({
  slug,
  aiTeam = false,
}: {
  slug: string;
  aiTeam?: boolean;
}) {
  const { project } = useShell();
  const Component = useProjectSections().find(
    (entry) => entry.slug === slug && (entry.group === 'ai-team') === aiTeam,
  )?.Component;
  const loading = useIsFetching() > 0;
  if (!Component) {
    if (!project || loading) return null;
    notFound();
  }
  return <Component />;
}
