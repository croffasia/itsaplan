import type { ReactNode } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

// Thin wrapper over shadcn Dialog that keeps the mount/unmount call style used
// across the app: callers render `{show && <Modal .../>}`, so the dialog is
// always open while mounted and onClose fires when Radix requests a close
// (overlay click or Escape).
// Width step: default, wide, or "xl" for a two-column body.
const MAX_WIDTH = {
  false: 'sm:max-w-[440px]',
  true: 'sm:max-w-[640px]',
  xl: 'sm:max-w-[860px]',
} as const;

const CONTROL_CLASS = 'size-7 text-muted-foreground hover:text-foreground';

export default function Modal({
  title,
  crumb,
  description,
  projectKey,
  onClose,
  children,
  wide = false,
  fullscreen = false,
  onToggleFullscreen,
  className,
}: {
  title: string;
  // Trailing breadcrumb naming what the dialog was opened for.
  crumb?: string;
  description?: string;
  projectKey?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean | 'xl';
  // On the dialog itself, for a caller that has to adjust its padding.
  className?: string;
  // Controlled by the caller: in fullscreen the content is a flex column, so the
  // caller's body has to claim the leftover space itself.
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const t = useTranslations('common');
  const FullscreenIcon = fullscreen ? Minimize2 : Maximize2;
  const fullscreenLabel = fullscreen ? t('exitFullscreen') : t('fullscreen');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // DialogContent sets only transition-duration, so every property
          // transitions (transition-property defaults to `all`). Toggling
          // fullscreen would then slide the dialog, unevenly: height and
          // max-width switch to/from `auto`/`none` and do not interpolate.
          'transition-none',
          fullscreen
            ? 'top-0 left-0 flex h-screen w-screen max-w-none translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-0 sm:max-w-none'
            : // A flex column, not the grid DialogContent defaults to: an auto grid
              // row keeps its content height under a capped container, so the body
              // never shrinks and never scrolls.
              cn('flex max-h-[85vh] flex-col overflow-hidden', MAX_WIDTH[`${wide}`]),
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {projectKey && (
              <>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-sm font-medium text-secondary-foreground">
                  {projectKey}
                </span>
                <span className="font-normal text-muted-foreground">›</span>
              </>
            )}
            {title}
            {crumb && (
              <>
                <span className="font-normal text-muted-foreground">›</span>
                <span className="font-normal text-muted-foreground">{crumb}</span>
              </>
            )}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {/* The body scrolls, not the dialog: the dialog stays the positioned
            ancestor a body-wide overlay can cover without scrolling away. A flex
            column either way, so a caller can hand the leftover height to one of
            its parts. */}
        <div
          className={cn(
            'flex min-h-0 flex-col',
            fullscreen ? 'flex-1 overflow-hidden' : 'overflow-y-auto',
          )}
        >
          {children}
        </div>
        {/* After the body: Radix focuses the first tabbable node on open, which
            should be a field of the body, not a control. */}
        <div className="absolute end-3 top-3 flex items-center gap-1">
          {onToggleFullscreen && (
            <Button
              variant="ghost"
              size="icon"
              className={CONTROL_CLASS}
              aria-label={fullscreenLabel}
              title={fullscreenLabel}
              // Toggling only swaps classes, so keeping the click from moving
              // focus leaves the caret in the field the user was editing.
              onMouseDown={(e) => e.preventDefault()}
              onClick={onToggleFullscreen}
            >
              <FullscreenIcon />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={CONTROL_CLASS}
            aria-label={t('close')}
            title={t('close')}
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
