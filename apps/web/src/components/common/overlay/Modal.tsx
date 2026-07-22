import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// Thin wrapper over shadcn Dialog that keeps the mount/unmount call style used
// across the app: callers render `{show && <Modal .../>}`, so the dialog is
// always open while mounted and onClose fires when Radix requests a close
// (overlay click, Escape, or the built-in close button).
// Width step: default, wide, or "xl" for a two-column body.
const MAX_WIDTH = {
  false: 'sm:max-w-[440px]',
  true: 'sm:max-w-[640px]',
  xl: 'sm:max-w-[860px]',
} as const;

export default function Modal({
  title,
  description,
  projectKey,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  projectKey?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean | 'xl';
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-h-[85vh] overflow-y-auto', MAX_WIDTH[`${wide}`])}>
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
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
