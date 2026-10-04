import { cn } from '@/lib/utils';

export const workspaceTileClass = (active: boolean) =>
  cn(
    'flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
    active
      ? 'bg-secondary text-secondary-foreground ring-2 ring-foreground/80 ring-offset-2 ring-offset-sidebar'
      : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  );

export const workspaceInitial = (name: string) => [...name.trim()][0]?.toUpperCase();
