import type { ReactNode } from 'react';
import DocumentSidebarButton from './DocumentSidebarButton';

export default function DocumentTopBar({ children }: { children: ReactNode }) {
  return (
    <header className="relative z-[5] flex h-12 shrink-0 items-center gap-1 bg-background px-3">
      <DocumentSidebarButton />
      {children}
    </header>
  );
}
