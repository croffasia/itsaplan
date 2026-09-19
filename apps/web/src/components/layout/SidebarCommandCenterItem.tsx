import Link from 'next/link';
import { Radar } from 'lucide-react';
import { SidebarMenuItem } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { commandCenterPath } from '@/utils/paths';
import { useCommandCenterQuery } from '@/features/command-center/services/commandCenter.service';

// The start page, set apart from the rest of the navigation: it is the one entry
// that is about the whole project rather than one section of it. The count is what
// is past its moment, so an empty badge means nothing is on fire.
export default function SidebarCommandCenterItem({
  projectKey,
  active,
  disabled,
}: {
  projectKey: string | null;
  active: boolean;
  disabled: boolean;
}) {
  const query = useCommandCenterQuery(projectKey ?? '');
  const critical = (query.data?.signals ?? []).filter(
    (signal) => signal.severity === 'critical' && signal.snoozedUntil === null,
  ).length;

  return (
    <SidebarMenuItem className="mb-1">
      <Link
        href={disabled || !projectKey ? '#' : commandCenterPath(projectKey)}
        aria-disabled={disabled}
        className={cn(
          'flex h-9 items-center gap-2 rounded-md border px-2 text-sm font-medium transition-colors',
          'group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0',
          active
            ? 'border-transparent bg-sidebar-accent'
            : 'bg-sidebar-accent/40 hover:bg-sidebar-accent',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <Radar className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
          Command Center
        </span>
        {critical > 0 && (
          <span className="shrink-0 rounded-full bg-destructive px-1.5 text-xs leading-5 font-semibold text-white tabular-nums group-data-[collapsible=icon]:hidden">
            {critical}
          </span>
        )}
      </Link>
    </SidebarMenuItem>
  );
}
