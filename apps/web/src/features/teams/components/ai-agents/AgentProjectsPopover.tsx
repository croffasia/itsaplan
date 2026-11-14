import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AgentProject } from '@/lib/api/endpoints/agents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// A list of this many projects or more gets a search box.
const SEARCH_FROM = 9;

// Every project an agent works in, behind the "+N" that follows the keys shown in its row.
// `onEdit` opens the agent's sheet, where the projects are changed, for a viewer who may.
export function AgentProjectsPopover({
  projects,
  hidden,
  onEdit,
}: {
  projects: AgentProject[];
  hidden: number;
  onEdit?: () => void;
}) {
  const t = useTranslations('teams.agents');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = q
    ? projects.filter((p) => p.key.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    : projects;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 shrink-0 px-1.5 text-xs text-muted-foreground"
          aria-label={t('showAllProjects', { count: projects.length })}
        >
          +{hidden}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <p className="px-3 pt-3 pb-2 text-sm font-medium">
          {t('projectsCount', { count: projects.length })}
        </p>
        {projects.length >= SEARCH_FROM && (
          <div className="px-2 pb-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('searchProjects')}
              aria-label={t('searchProjects')}
              className="h-8"
            />
          </div>
        )}
        <ul className="max-h-64 overflow-y-auto border-t p-1">
          {list.map((project) => (
            <li key={project.id} className="flex items-center gap-2.5 px-2 py-1.5 text-sm">
              <span className="w-16 shrink-0 truncate font-mono text-xs" dir="ltr">
                {project.key}
              </span>
              <span className="truncate text-muted-foreground" dir="auto">
                {project.name}
              </span>
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              {t('noMatch', { query: query.trim() })}
            </li>
          )}
        </ul>
        {onEdit && (
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
              {t('changeProjects')}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
