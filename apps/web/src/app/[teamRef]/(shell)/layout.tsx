import type { ReactNode } from 'react';
import { Suspense } from 'react';
import ProjectShellLayout from '@/components/layout/ProjectShellLayout';
import Shell from '@/components/layout/Shell';

// The project layout owns the planner Shell (sidebar, header, overlays, project
// data) and renders the active child route inside it. The cookie-backed sidebar
// state is a Suspense hole so the rest of the layout can render without waiting
// on the cookie store.
export default function ProjectLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<Shell defaultSidebarOpen>{children}</Shell>}>
      <ProjectShellLayout>{children}</ProjectShellLayout>
    </Suspense>
  );
}
