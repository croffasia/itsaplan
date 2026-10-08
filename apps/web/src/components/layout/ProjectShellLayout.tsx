import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import Shell from '@/components/layout/Shell';

// Reads the persisted sidebar cookie and mounts the planner Shell. Split from the
// project layout so that layout can wrap this async work in Suspense instead of
// blocking the whole tree on the cookie store.
export default async function ProjectShellLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';
  return <Shell defaultSidebarOpen={defaultSidebarOpen}>{children}</Shell>;
}
