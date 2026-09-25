'use client';

import { useParams } from 'next/navigation';
import LegacyRedirect from '@/components/common/LegacyRedirect';
import { issuePath, parseIssueIdentifier, projectPath, teamPath } from '@/utils/paths';

// /acme opens the team's first project, or its settings when it has none it shows.
// /MKT-42 is the issue short link from before keys were unique per team: the slug
// is lower case and an identifier is not, so the two never meet.
export default function Page() {
  const { teamRef } = useParams<{ teamRef: string }>();
  const segment = decodeURIComponent(teamRef);
  const issue = /^[A-Z]/.test(segment) ? parseIssueIdentifier(segment) : null;

  return (
    <LegacyRedirect
      resolve={(projects) => {
        if (issue) {
          const matches = projects.filter((project) => project.key === issue.key);
          return matches.length === 1 ? issuePath(matches[0].ref, issue.sequenceNumber) : null;
        }
        const ofTeam = projects.filter(
          (project) => project.teamRef === segment || String(project.teamId) === segment,
        );
        const first = ofTeam.find((project) => !project.isHidden) ?? ofTeam[0];
        return first ? projectPath(first.ref) : teamPath(segment);
      }}
    />
  );
}
