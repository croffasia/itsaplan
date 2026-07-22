import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import Shell from '@/components/layout/Shell';

// The project layout owns the planner Shell (sidebar, header, overlays, project
// data) and renders the active child route inside it. The sidebar open/collapsed
// state is persisted in the `sidebar_state` cookie by SidebarProvider; read it
// here so the sidebar renders in its last state on first paint (no flicker).
export default async function ProjectLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  return <Shell defaultSidebarOpen={defaultSidebarOpen}>{children}</Shell>;
}
