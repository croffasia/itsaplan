'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isTypingTarget } from '@/utils/hotkeys';

// The column beside the canvas that holds the page details or the comments. On a narrow
// screen it lies over the page from the inline end.
export default function DocumentSidePanel({
  label,
  closeLabel,
  actions,
  onClose,
  children,
}: {
  label: string;
  closeLabel: string;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className="flex min-h-0 w-[360px] shrink-0 flex-col bg-rail motion-safe:animate-in motion-safe:duration-200 motion-safe:slide-in-from-end-3 motion-safe:fade-in max-md:fixed max-md:inset-y-0 max-md:end-0 max-md:z-40 max-md:w-[min(92vw,380px)] max-md:pt-[env(safe-area-inset-top)] max-md:shadow-[var(--side-panel-shadow)]"
      onKeyDown={(event) => {
        // Escape in a text box keeps the panel open, so a draft is not lost.
        if (event.key === 'Escape' && !event.defaultPrevented && !isTypingTarget(event.target))
          onClose();
      }}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 ps-4 pe-2">
        <h2 className="text-sm font-semibold">{label}</h2>
        {actions}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ms-auto text-muted-foreground"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
        >
          <X />
        </Button>
      </header>
      {children}
    </aside>
  );
}
