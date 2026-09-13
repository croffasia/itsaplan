import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Project } from '@/lib/api/endpoints/projects';
import { useUpdateProjectPreferences } from '@/services/projects.service';
import { EmptyState } from '@/components/common/page/EmptyState';
import { Button } from '@/components/ui/button';

export default function ProjectSwitcherHiddenState({ projects }: { projects: Project[] }) {
  const t = useTranslations('nav.projectPicker');
  const update = useUpdateProjectPreferences();
  const [expanded, setExpanded] = useState(false);
  const hiddenProjects = projects.filter((project) => project.isHidden);

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center p-6">
      <EmptyState title={t('allHiddenTitle')} description={t('allHiddenDescription')}>
        <Button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
          <Eye />
          {t('showHidden', { count: hiddenProjects.length })}
        </Button>
        {expanded && (
          <ul className="max-h-[50vh] w-full space-y-2 overflow-y-auto">
            {hiddenProjects.map((project) => (
              <li key={project.id}>
                <Button
                  variant="outline"
                  className="h-auto min-h-9 w-full justify-start py-2 text-start whitespace-normal"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ projectKey: project.key, patch: { isHidden: false } })
                  }
                >
                  <Eye />
                  <span className="min-w-0 wrap-anywhere" dir="auto">
                    {t('showProject', { name: project.name })}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </EmptyState>
    </div>
  );
}
