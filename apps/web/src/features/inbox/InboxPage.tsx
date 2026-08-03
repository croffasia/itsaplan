'use client';

import { useShell } from '@/context/shellContext';
import InboxView from './components/InboxView';

// The per-project inbox (/project/:projectKey/inbox): a list of the session user's
// notifications for this project on the left, the selected issue on the right. On a
// narrow screen only one of the two is on screen at a time.
export default function InboxPage() {
  const { project } = useShell();
  if (!project) return null;
  // Keyed by project: the stored filters are read on mount.
  return <InboxView key={project.project.key} project={project} />;
}
