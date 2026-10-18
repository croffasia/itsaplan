import { Eye, EyeOff, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { useUpdateProjectPreferences } from '@/services/projects.service';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function ProjectSwitcherRowMenu({ project }: { project: Project }) {
  const t = useTranslations('nav.projectPicker');
  const update = useUpdateProjectPreferences();
  const label = t('moreActions', { name: project.name });

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-10 shrink-0 text-muted-foreground md:size-7 md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100 md:group-has-[[data-selected=true]]/row:opacity-100 md:data-[state=open]:opacity-100"
          aria-label={label}
          title={label}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={update.isPending}
          onSelect={() =>
            update.mutate({ projectKey: project.ref, patch: { isHidden: !project.isHidden } })
          }
        >
          {project.isHidden ? <Eye /> : <EyeOff />}
          {t(project.isHidden ? 'unhide' : 'hide')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
