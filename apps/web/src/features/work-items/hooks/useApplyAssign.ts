import type { ProjectDetail } from '@/lib/api';
import type { GroupAssign } from '@/utils/project';
import { memberFieldValue } from '@/utils/memberFields';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';

// Applies what a drop into a group assigns, shared by the boards and the row
// layouts: the built-in fields and the new position in one patch, then a write per
// member custom field the grouping levels name. A field the issue already holds is
// left alone — rewriting the same value would log another activity entry and start
// another run of an agent that reacts to the field.
export function useApplyAssign(project: ProjectDetail) {
  const updateIssue = useUpdateIssue(project.project.key);
  const setFieldValue = useSetFieldValue(project.project.key);

  return function applyAssign(issueId: number, assign: GroupAssign | null, position: number) {
    updateIssue.mutate({ id: issueId, patch: { ...assign?.patch, position } });
    const issue = project.issues.find((i) => i.id === issueId);
    for (const { fieldId, userId } of assign?.fields ?? []) {
      if (issue && memberFieldValue(issue, fieldId) === userId) continue;
      setFieldValue.mutate({ issueId, fieldId, value: { value: userId } });
    }
  };
}
