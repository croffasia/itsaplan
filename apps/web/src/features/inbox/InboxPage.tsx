'use client';

import { useShell } from '@/context/shellContext';
import InboxView from './components/InboxView';

// The per-project inbox (/project/:projectKey/inbox): a list of the session user's
// notifications for this project on the left, the selected issue on the right.
export default function InboxPage() {
  const { project } = useShell();
  if (!project) return null;
  return <InboxView project={project} />;
}
