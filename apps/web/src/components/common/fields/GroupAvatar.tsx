import { Users } from 'lucide-react';
import type { ProjectGroup } from '@/lib/api/endpoints/groups';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// The marker of an assignee group: a square in the group's color, so it reads apart
// from the round avatar of a person next to it. The group's name is in a tooltip.
export default function GroupAvatar({
  group,
  className,
}: {
  group: Pick<ProjectGroup, 'name' | 'color'>;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-md text-white',
            className,
          )}
          style={{ backgroundColor: group.color }}
        >
          <Users className="size-3" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{group.name}</TooltipContent>
    </Tooltip>
  );
}
