import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { KIE_DOCS } from './client';

// A model page holds an OpenAPI spec of its createTask call. The tool returns the part
// from the summary to the responses: the usage notes and the request schema. The rest
// is the shared response and error boilerplate.
export const kieModelDocs: CustomToolEntry = {
  key: 'kie_model_docs',
  label: 'Kie Model docs',
  description:
    'Read the API docs of one Kie model: its model id, its input fields with their limits and allowed values, and an example request. Call it before kie_create_task, because each model has different input fields.',
  inputSchema: z.object({
    page: z
      .string()
      .regex(/^[a-z0-9][a-z0-9/_-]*$/, 'A docs page from kie_find_models, without ".md".')
      .describe('The docs page from kie_find_models, e.g. "market/google/nano-banana-edit".'),
  }),
  execute: async (_credential, input) => {
    const res = await fetch(`${KIE_DOCS}/${String(input.page)}.md`);
    if (!res.ok) throw new Error(`Kie model docs failed (${res.status})`);
    const text = await res.text();
    if (!text.includes('/api/v1/jobs/createTask:')) {
      throw new Error(
        `The page ${String(input.page)} does not describe a createTask model. Use a page from kie_find_models.`,
      );
    }
    const start = text.indexOf('summary:');
    const end = text.indexOf('\n      responses:', start);
    const docs = text
      .slice(start, end === -1 ? undefined : end)
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.includes('x-apidog'))
      .join('\n');
    return { page: input.page, docs };
  },
};
