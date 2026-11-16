import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { MAX_WAIT_SECONDS, kieRequest, waitForTask } from './client';

export const kieCreateTask: CustomToolEntry = {
  key: 'kie_create_task',
  label: 'Kie Create task',
  description:
    'Start a Kie generation task (an image, a video, music or speech) and wait for its result. Get the model id and the input fields from kie_model_docs first. Pass input files as URLs that Kie can download, for example the url of an issue attachment. On success, result holds the URLs of the output files. Kie deletes output files after 14 days: to keep a file, attach it to the issue. A video often takes longer than the wait: if the state is still waiting, queuing or generating, or the result could not be read, call kie_get_task later with the taskId. Each task spends credits of the Kie account.',
  inputSchema: z.object({
    model: z
      .string()
      .min(1)
      .describe('The model id from kie_model_docs, e.g. "google/nano-banana-edit".'),
    input: z
      .record(z.string(), z.any())
      .describe(
        'The input object of the model, with the fields from kie_model_docs, e.g. {"prompt": "...", "aspect_ratio": "16:9"}.',
      ),
    waitSeconds: z
      .number()
      .int()
      .min(0)
      .max(MAX_WAIT_SECONDS)
      .default(60)
      .describe('How long to wait for the result. An image takes 10 to 60 seconds.'),
  }),
  execute: async (credential, input) => {
    const apiKey = String(credential.apiKey);
    const created = (await kieRequest(
      apiKey,
      'jobs/createTask',
      { model: String(input.model), input: input.input },
      'Kie create task',
    )) as { taskId?: string } | null;
    const { taskId } = created ?? {};
    if (!taskId) throw new Error('Kie create task did not return a taskId');
    try {
      return await waitForTask(apiKey, taskId, Number(input.waitSeconds ?? 60));
    } catch (err) {
      // The task is created and paid for: with its taskId the agent can read it later.
      return { taskId, state: 'unknown', error: err instanceof Error ? err.message : String(err) };
    }
  },
};
