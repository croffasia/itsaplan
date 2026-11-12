import type { Issue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { NewIssueDefaults } from '@/utils/project';
import type { DateField } from '@/utils/viewSettings';
import { useSetFieldValue, useUpdateIssue } from '@/services/issues.service';
import {
  calendarBuiltinField,
  calendarCustomField,
  issueDay,
  rescheduleFieldValue,
} from '@/utils/calendarFields';
import { useQuickCreate } from './useQuickCreate';

// Reads and writes the date the calendar places issues by: the built-in column, or
// the custom field's value (which keeps its time of day and, for a range, its
// length).
export function useCalendarSchedule({
  project,
  dateField,
  newIssueDefaults,
}: {
  project: ProjectDetail;
  dateField: DateField;
  newIssueDefaults: NewIssueDefaults;
}) {
  const quickCreate = useQuickCreate(project);
  const updateIssue = useUpdateIssue(project.project.ref);
  const setFieldValue = useSetFieldValue(project.project.ref);
  const builtin = calendarBuiltinField(dateField);
  const custom = calendarCustomField(dateField, project.customFields);

  function reschedule(issue: Issue, day: string | null) {
    if (!custom) {
      updateIssue.mutate({ id: issue.id, patch: { [builtin]: day } });
      return;
    }
    setFieldValue.mutate({
      issueId: issue.id,
      fieldId: custom.id,
      value: rescheduleFieldValue(issue, custom, day),
    });
  }

  // A built-in date is part of the create request. A custom field is set once the
  // issue exists.
  async function create(day: string, title: string) {
    const created = await quickCreate({
      ...newIssueDefaults,
      title,
      ...(custom ? {} : { [builtin]: day }),
    });
    if (custom) reschedule(created, day);
  }

  return {
    dayOf: (issue: Issue) => issueDay(issue, builtin, custom),
    reschedule,
    create,
  };
}
