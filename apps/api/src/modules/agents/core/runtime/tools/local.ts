import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createMappedImport } from '#modules/imports/service';

// The agent tools with no route behind them. Everything an agent does to a project
// goes through the real API (see route-tools.ts); this is what is left over.
//
// The current date is not a project resource, so exposing it over REST would add an
// endpoint that exists only for the agent. It is answered in process instead.
// prepare_issue_import is the same kind of thing: it works on a file already
// stored by the chat-attachments routes, and the draft it creates exists for the
// user's review, not for the API's surface. It is gated like any capability: built
// only when the agent has it enabled.

export function buildLocalTools(
  projectId: number,
  enabledTools: string[],
): Record<string, ReturnType<typeof createTool>> {
  const enabled = new Set(enabledTools);

  // The mapping step of an issue import: reading the file is covered by the
  // read_chat_attachment route tool; what is left is turning the attachment into
  // the draft the review card renders. Issues are still created by the confirm
  // route alone, when the user presses the button.
  const prepare_issue_import = createTool({
    id: 'prepare_issue_import',
    description:
      'Turn a file uploaded in the chat into an issue import draft: save which column of the ' +
      'file feeds which issue field ("title" required; description, priority, dueDate, labels, ' +
      'and assignee optional). Read the file first with read_chat_attachment to see its headers ' +
      'and rows. Issues are NOT created here — after saving, tell the user to review the preview ' +
      'below and end the reply with a ```issue-import fenced code block whose content is exactly ' +
      '{"importId": "<the returned id>"} so the review card renders.',
    inputSchema: z.object({
      attachmentId: z
        .string()
        .describe('The attachment id from the [file: "name" (attachment id: …)] marker.'),
      mapping: z
        .record(z.string(), z.string())
        .describe('Issue field -> column header, e.g. {"title": "Task", "dueDate": "Deadline"}.'),
    }),
    execute: async ({ attachmentId, mapping }) => {
      const draft = await createMappedImport(projectId, attachmentId, mapping);
      return {
        ok: true,
        importId: draft.id,
        status: draft.status,
        nextStep:
          'Tell the user the mapping is ready for their review, and end the reply with a ' +
          '```issue-import fenced code block containing {"importId": "' +
          draft.id +
          '"}. Nothing is created until they press Confirm.',
      };
    },
  });

  return {
    get_current_date: createTool({
      id: 'get_current_date',
      description:
        'Get the current date and time (UTC, ISO 8601). Always call this to resolve any relative date such as today, tomorrow, next week, or a due date; never assume or guess the current date.',
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        return { iso: now.toISOString(), date: now.toISOString().slice(0, 10) };
      },
    }),
    ...(enabled.has('prepare_issue_import') ? { prepare_issue_import } : {}),
  };
}
