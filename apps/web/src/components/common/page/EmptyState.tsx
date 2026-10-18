import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import OrbitMark from '@/components/brand/system/OrbitMark';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty';

// The "nothing here yet" block. `children` holds the action; pages with no action
// to offer omit it. It grows to fill the space left over (`flex-1`), so mount it in
// a flex column of a known height — in a plain block parent it keeps content height
// and sits at the top.
export function EmptyState({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <OrbitMark icon={icon} still className="mb-2 w-30" />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children && <EmptyContent>{children}</EmptyContent>}
    </Empty>
  );
}
