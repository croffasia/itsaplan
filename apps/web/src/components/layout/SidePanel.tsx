'use client';

import type { ReactNode } from 'react';
import { Direction } from 'radix-ui';
import { useIsMobile } from '@/hooks/use-mobile';
import type { SidePanelMode } from '@/hooks/useSidePanel';
import { cn } from '@/lib/utils';
import ResizeGrip from '@/components/common/ResizeGrip';

// A panel on the end edge of the content area. In push mode it is a column of the
// content row, which narrows the page next to it; in overlay mode it stands over that
// page. A narrow screen has no room for a narrower page, so it is always overlay, over
// the full width. Fullscreen takes the panel out of the content row and over the whole
// viewport, the same way a dialog expands.
export default function SidePanel({
  label,
  resizeLabel,
  open,
  mode,
  fullscreen,
  width,
  onWidthChange,
  children,
}: {
  label: string;
  resizeLabel: string;
  open: boolean;
  mode: SidePanelMode;
  fullscreen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  children: ReactNode;
}) {
  const direction = Direction.useDirection();
  const isMobile = useIsMobile();
  const overlay = isMobile || mode === 'overlay';

  return (
    <aside
      aria-label={label}
      className={cn(
        'flex h-full min-h-0 flex-col bg-background',
        !open && 'hidden',
        fullscreen
          ? 'fixed inset-0 z-50'
          : cn(
              'z-30 border-s',
              overlay
                ? 'absolute inset-y-0 end-0 shadow-[var(--side-panel-shadow)]'
                : 'relative shrink-0',
            ),
      )}
      style={fullscreen ? undefined : { width: isMobile ? '100%' : width }}
    >
      {!isMobile && !fullscreen && (
        <ResizeGrip
          label={resizeLabel}
          className="absolute inset-y-0 start-0 z-10"
          onDrag={(deltaX) => onWidthChange(width + (direction === 'rtl' ? deltaX : -deltaX))}
        />
      )}
      {children}
    </aside>
  );
}
