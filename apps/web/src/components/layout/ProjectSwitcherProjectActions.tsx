import { Archive, ArchiveRestore, MoreHorizontal, Star } from 'lucide-react';
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

export default function ProjectSwitcherProjectActions({ project }: { project: Project }) {
  const t = useTranslations('nav.projectPicker');
  const update = useUpdateProjectPreferences();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground"
          aria-label={t('projectActions', { name: project.name })}
          title={t('projectActions', { name: project.name })}
          disabled={update.isPending}
          onKeyDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onKeyDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {!project.isHidden && (
          <DropdownMenuItem
            onSelect={() =>
              update.mutate({ projectKey: project.key, patch: { isFavorite: !project.isFavorite } })
            }
          >
            <Star className={project.isFavorite ? 'fill-current' : undefined} />
            {t(project.isFavorite ? 'unstarAction' : 'starAction')}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() =>
            update.mutate({ projectKey: project.key, patch: { isHidden: !project.isHidden } })
          }
        >
          {project.isHidden ? <ArchiveRestore /> : <Archive />}
          {t(project.isHidden ? 'restoreAction' : 'hideAction')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
