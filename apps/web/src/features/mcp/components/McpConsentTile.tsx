import type { ReactNode } from 'react';

export default function McpConsentTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-base font-semibold ring-1 ring-border ring-inset">
      {children}
    </span>
  );
}
