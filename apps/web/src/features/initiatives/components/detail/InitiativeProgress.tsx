'use client';

import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Initiative } from '@/lib/api/endpoints/initiatives';
import InitiativeActivityFeed from './InitiativeActivityFeed';
import InitiativeActiveWork from './InitiativeActiveWork';
import InitiativeStateBreakdown from './InitiativeStateBreakdown';
import InitiativeTimeline from './InitiativeTimeline';

// How the initiative is going: the state breakdown, the timeline and the work in
// flight, with the activity feed beside them and below them on a narrow screen.
export default function InitiativeProgress({
  initiative,
  project,
}: {
  initiative: Initiative;
  project: ProjectDetail;
}) {
  const t = useTranslations('initiatives');
  const projectKey = project.project.key;

  return (
    <div className="flex w-full flex-col gap-10 px-8 py-8 lg:flex-row">
      <div className="min-w-0 lg:w-2/3">
        <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
          <InitiativeStateBreakdown project={project} initiativeId={initiative.id} />
          <InitiativeTimeline initiative={initiative} />
        </div>

        <InitiativeActiveWork project={project} initiativeId={initiative.id} />
      </div>

      <aside className="min-w-0 lg:w-1/3">
        <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t('activity')}
        </h3>
        <InitiativeActivityFeed initiativeId={initiative.id} projectKey={projectKey} />
      </aside>
    </div>
  );
}
