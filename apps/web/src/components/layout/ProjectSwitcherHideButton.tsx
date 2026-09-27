import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { cn } from '@/lib/utils';
import { useUpdateProjectPreferences } from '@/services/projects.service';
import { Button } from '@/components/ui/button';

export default function ProjectSwitcherHideButton({ project }: { project: Project }) {
  const t = useTranslations('nav.projectPicker');
  const update = useUpdateProjectPreferences();
  const label = t(project.isHidden ? 'showProject' : 'hideProject', { name: project.name });

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className={cn(
        'size-10 shrink-0 text-muted-foreground md:size-7',
        !project.isHidden &&
          'md:opacity-0 md:group-focus-within/row:opacity-100 md:group-hover/row:opacity-100 md:group-has-[[data-selected=true]]/row:opacity-100',
      )}
      aria-label={label}
      title={label}
      disabled={update.isPending}
      onKeyDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        update.mutate({ projectKey: project.ref, patch: { isHidden: !project.isHidden } });
      }}
    >
      {project.isHidden ? <Eye /> : <EyeOff />}
    </Button>
  );
}
