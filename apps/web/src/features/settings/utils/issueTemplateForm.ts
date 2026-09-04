import type { IssueTemplate, NewIssueTemplateInput } from '@/lib/api';

// The template as the settings dialog edits it. `priority` is '' for none, the way
// PrioritySelect carries it; the other properties are null when the template
// presets nothing.
export interface IssueTemplateFormValues {
  name: string;
  description: string;
  titleTemplate: string;
  descriptionTemplate: string;
  typeId: number | null;
  columnId: number | null;
  priority: string;
  assigneeUserId: string | null;
  labelIds: number[];
}

export function templateFormValues(template?: IssueTemplate): IssueTemplateFormValues {
  return {
    name: template?.name ?? '',
    description: template?.description ?? '',
    titleTemplate: template?.titleTemplate ?? '',
    descriptionTemplate: template?.descriptionTemplate ?? '',
    typeId: template?.typeId ?? null,
    columnId: template?.columnId ?? null,
    priority: template?.priority ?? '',
    assigneeUserId: template?.assigneeUserId ?? null,
    labelIds: template?.labelIds ?? [],
  };
}

export function templateInput(values: IssueTemplateFormValues): NewIssueTemplateInput {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    titleTemplate: values.titleTemplate.trim(),
    descriptionTemplate: values.descriptionTemplate,
    typeId: values.typeId,
    columnId: values.columnId,
    priority: values.priority || null,
    assigneeUserId: values.assigneeUserId,
    labelIds: values.labelIds,
  };
}
