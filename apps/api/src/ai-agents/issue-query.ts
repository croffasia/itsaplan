import { z } from 'zod';

const date = z.iso.date().describe('Date in YYYY-MM-DD format.');

export const issueQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Case-insensitive text search in the issue identifier, title, and description.'),
  columnId: z.number().optional().describe('Exact workflow state (column) id from get_project.'),
  typeId: z
    .number()
    .nullable()
    .optional()
    .describe('Exact issue type id from get_project, or null for issues without a type.'),
  initiativeId: z
    .number()
    .nullable()
    .optional()
    .describe(
      'Exact initiative id from list_initiatives, or null for issues without an initiative.',
    ),
  assigneeUserId: z
    .string()
    .nullable()
    .optional()
    .describe('Exact member user id from get_project, or null for unassigned issues.'),
  delegateUserId: z
    .string()
    .nullable()
    .optional()
    .describe('Exact agent user id from get_project, or null for issues without a delegate.'),
  priority: z
    .string()
    .nullable()
    .optional()
    .describe('Exact priority value, or null for issues without a priority.'),
  labelIds: z
    .array(z.number())
    .min(1)
    .optional()
    .describe('Label ids from get_project. An issue must contain every supplied label.'),
  dueFrom: date.optional().describe('Inclusive earliest due date in YYYY-MM-DD format.'),
  dueTo: date.optional().describe('Inclusive latest due date in YYYY-MM-DD format.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .describe('Maximum number of issues to return, from 1 to 200.'),
});

export type IssueQuery = z.infer<typeof issueQuerySchema>;
