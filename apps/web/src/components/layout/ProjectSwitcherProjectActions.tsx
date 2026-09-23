import { useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);
  const touchPress = useRef(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-10 shrink-0 text-muted-foreground md:size-7"
          aria-label={t('projectActions', { name: project.name })}
          title={t('projectActions', { name: project.name })}
          disabled={update.isPending}
          onPointerDown={(event) => {
            // Radix opens on pointerdown, before a touch can become a scroll.
            touchPress.current = event.pointerType === 'touch';
            if (touchPress.current) event.preventDefault();
          }}
          onPointerCancel={() => {
            touchPress.current = false;
          }}
          onKeyDown={(event) => {
            touchPress.current = false;
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (touchPress.current) setOpen((value) => !value);
            touchPress.current = false;
          }}
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
