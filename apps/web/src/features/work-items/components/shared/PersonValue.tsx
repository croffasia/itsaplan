import type { Assignee } from '@/lib/api/endpoints/projects';
import Avatar from '@/components/common/Avatar';

// A person or an agent named beside their avatar, or a dash for nobody.
export function PersonValue({ person }: { person: Assignee | undefined }) {
  if (!person) {
    return (
      <div>
        <span className="text-muted-foreground/40">—</span>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <Avatar name={person.name} image={person.image} className="size-4 text-[8px]" />
      <span className="truncate">{person.name}</span>
    </div>
  );
}
