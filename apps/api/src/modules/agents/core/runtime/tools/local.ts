import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getImport, readImportTable, saveMapping } from '#modules/imports/service';
import { IMPORT_FIELDS } from '#modules/imports/mapping';

// The agent tools with no route behind them. Everything an agent does to a project
// goes through the real API (see route-tools.ts); this is what is left over.
//
// The current date is not a project resource, so exposing it over REST would add an
// endpoint that exists only for the agent. It is answered in process instead. The
// two import tools are the same kind of thing — they work on a file already stored
// by the uploads route — but they are gated like any capability: they are built
// only when the agent has them enabled.

export function buildLocalTools(
  projectId: number,
  enabledTools: string[],
): Record<string, ReturnType<typeof createTool>> {
  const enabled = new Set(enabledTools);

  // Reads the stored file and answers with its table shape.
  const read_import_file = createTool({
    id: 'read_import_file',
    description:
      'Read a file the user uploaded for issue import (.xlsx, .csv, or .docx with a table). ' +
      'Returns the column headers and the first rows. Decide next which column feeds which ' +
      'issue field and save that with save_import_mapping.',
    inputSchema: z.object({
      importId: z
        .string()
        .describe(
          'The import id the uploaded file carries, e.g. from [file for import: "tasks.xlsx" (import id: …)].',
        ),
    }),
    execute: async ({ importId }) => {
      const row = await getImport(importId);
      if (!row || row.projectId !== projectId) throw new Error('Import not found.');
      const parsed = await readImportTable(importId);
      return {
        filename: row.filename,
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 10),
        totalRows: parsed.totalRows,
        mappableFields: IMPORT_FIELDS,
        nextStep:
          'Choose the header that feeds each field and call save_import_mapping with ' +
          '{ field: header } pairs. "title" is required.',
      };
    },
  });

  // Stores the chosen column mapping on the draft and tells the model how the
  // confirmation reaches the user.
  const save_import_mapping = createTool({
    id: 'save_import_mapping',
    description:
      'Save the column mapping of an uploaded import file: which header feeds title, ' +
      'description, priority, dueDate, labels, or assignee ("title" required). Issues are ' +
      'NOT created here — after saving, tell the user to review the preview below and ' +
      'include a ```issue-import fenced code block whose content is exactly ' +
      '{"importId": "<the id>"} so the review card renders.',
    inputSchema: z.object({
      importId: z.string(),
      mapping: z
        .record(z.string(), z.string())
        .describe('Issue field -> column header, e.g. {"title": "Task", "dueDate": "Deadline"}.'),
    }),
    execute: async ({ importId, mapping }) => {
      const row = await getImport(importId);
      if (!row || row.projectId !== projectId) throw new Error('Import not found.');
      await saveMapping(importId, mapping);
      return {
        ok: true,
        status: 'mapped',
        nextStep:
          'Tell the user the mapping is ready for their review, and end the reply with a ' +
          '```issue-import fenced code block containing {"importId": "' +
          importId +
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
    ...(enabled.has('read_import_file') ? { read_import_file } : {}),
    ...(enabled.has('save_import_mapping') ? { save_import_mapping } : {}),
  };
}
