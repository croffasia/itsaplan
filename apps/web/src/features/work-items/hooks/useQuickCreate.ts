import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { useSession } from '@/lib/auth-client';
import { newIssueInput, type NewIssueDefaults } from '@/utils/project';
import { useCreateIssue, useSetFieldValue } from '@/services/issues.service';

// Creates an issue from defaults without the dialog. Member custom fields are not
// part of the create request, so they are set once the issue exists.
export function useQuickCreate(project: ProjectDetail) {
  const { data: session } = useSession();
  const createIssue = useCreateIssue();
  const setFieldValue = useSetFieldValue(project.project.ref);

  return async function quickCreate(defaults: NewIssueDefaults) {
    const created = await createIssue.mutateAsync({
      projectKey: project.project.ref,
      input: newIssueInput(project, defaults, session?.user.id ?? null),
    });
    for (const { fieldId, userId } of defaults.fieldValues ?? []) {
      setFieldValue.mutate({ issueId: created.id, fieldId, value: { value: userId } });
    }
    return created;
  };
}
