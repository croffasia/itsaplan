'use client';

import { useParams } from 'next/navigation';
import LegacyRedirect from '@/components/common/LegacyRedirect';
import { useIssueQuery } from '@/services/issues.service';
import { issuePath } from '@/utils/paths';

// A bare deep link /issue/:issueId carries neither the team nor the key: the issue
// names its project by id, which the viewer's project list maps to its path.
export default function IssueRedirect() {
  const { issueId } = useParams<{ issueId: string }>();
  const id = Number(issueId);
  const { data, isLoading } = useIssueQuery(Number.isNaN(id) ? null : id);

  if (isLoading) return null;
  return (
    <LegacyRedirect
      resolve={(projects) => {
        const project = data && projects.find((p) => p.id === data.projectId);
        return project && issuePath(project.ref, data.sequenceNumber);
      }}
    />
  );
}
