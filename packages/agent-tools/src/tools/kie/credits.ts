import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { kieRequest } from './client';

export const kieCredits: CustomToolEntry = {
  key: 'kie_credits',
  label: 'Kie Credits',
  description: 'Get the remaining credit balance of the Kie account.',
  inputSchema: z.object({}),
  execute: async (credential) => ({
    credits: await kieRequest(String(credential.apiKey), 'chat/credit', null, 'Kie credits'),
  }),
};
