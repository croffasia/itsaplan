import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// One collapsible section of the issue detail.
export default function IssueSection({
  collapsed,
  className,
  ...props
}: { collapsed: boolean } & ComponentProps<'div'>) {
  return <div className={cn('mt-5 border-t pt-3', collapsed && '-mb-2', className)} {...props} />;
}
