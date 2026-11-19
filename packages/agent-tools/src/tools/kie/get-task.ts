import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { MAX_WAIT_SECONDS, waitForTask } from './client';

export const kieGetTask: CustomToolEntry = {
  key: 'kie_get_task',
  label: 'Kie Get task',
  description:
    'Get the state and the result of a Kie task by its taskId, and wait for the task to finish. On success, result holds the URLs of the output files.',
  inputSchema: z.object({
    taskId: z.string().min(1).describe('The taskId from kie_create_task.'),
    waitSeconds: z
      .number()
      .int()
      .min(0)
      .max(MAX_WAIT_SECONDS)
      .default(60)
      .describe('How long to wait for the task to finish. 0 returns the state now.'),
  }),
  execute: async (credential, input) =>
    waitForTask(String(credential.apiKey), String(input.taskId), Number(input.waitSeconds ?? 60)),
};
