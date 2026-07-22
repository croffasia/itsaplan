'use client';

import type { Initiative, ProjectDetail } from '@/lib/api';
import InitiativeActivityFeed from './InitiativeActivityFeed';
import InitiativeActiveWork from './InitiativeActiveWork';
import InitiativeStateBreakdown from './InitiativeStateBreakdown';
import InitiativeTimeline from './InitiativeTimeline';

// The initiative overview: a content column with the activity feed beside it,
// stacking below it on a narrow screen.
export default function InitiativeOverview({
  initiative,
  project,
}: {
  initiative: Initiative;
  project: ProjectDetail;
}) {
  const projectKey = project.project.key;
  const hasDescription = initiative.description.trim().length > 0;

  return (
    <div className="flex w-full flex-col gap-10 px-8 py-8 lg:flex-row">
      <div className="min-w-0 lg:w-2/3">
        <h1 className="text-2xl font-semibold tracking-tight">{initiative.title}</h1>
        {hasDescription ? (
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {initiative.description}
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground/60 italic">No description.</p>
        )}

        <div className="mt-8 grid gap-8 sm:grid-cols-2 sm:gap-10">
          <InitiativeStateBreakdown project={project} initiativeId={initiative.id} />
          <InitiativeTimeline initiative={initiative} />
        </div>

        <InitiativeActiveWork project={project} initiativeId={initiative.id} />
      </div>

      <aside className="min-w-0 lg:w-1/3">
        <h3 className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Activity
        </h3>
        <InitiativeActivityFeed initiativeId={initiative.id} projectKey={projectKey} />
      </aside>
    </div>
  );
}
