import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// A full-screen empty state with one action, for the start page before the account
// has a team or a project.
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
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-svh items-center justify-center p-6">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{hint}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onAction}>
            <Plus />
            {action}
          </Button>
        </EmptyContent>
      </Empty>
      {children}
    </div>
  );
}
