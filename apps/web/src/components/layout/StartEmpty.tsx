import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LocaleToggle } from '@/components/locale-toggle';
import { ThemeToggle } from '@/components/theme-toggle';
import UserMenu from '@/components/layout/UserMenu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// A full-screen empty state for the start page before the account has a team or a project.
// The start page has no shell, so it carries the header controls: signing out and the
// language stay within reach of somebody waiting to be added to a team.
export default function StartEmpty({
  icon,
  title,
  hint,
  action,
  onAction,
  children,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex h-svh items-center justify-center p-6">
      <div className="absolute top-3 right-4 flex items-center gap-1">
        <LocaleToggle />
        <ThemeToggle />
        <UserMenu />
      </div>
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{hint}</EmptyDescription>
        </EmptyHeader>
        {action && (
          <EmptyContent>
            <Button onClick={onAction}>
              <Plus />
              {action}
            </Button>
          </EmptyContent>
        )}
      </Empty>
      {children}
    </div>
  );
}
