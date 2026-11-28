'use client';

import type { IssueWithWatchers } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';

// After an issue's own sections, in the issue panel and on its page. A self-hosted instance
// adds none; a build renders its own here, each with IssueSection and IssueSectionHeading as
// the core's are.
export default function IssueSectionExtras(_props: {
  project: ProjectDetail;
  issue: IssueWithWatchers;
}) {
  return null;
}
