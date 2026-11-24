import { z } from 'zod';
import type { CustomToolEntry } from '../../types';
import { KIE_DOCS } from './client';

// The docs index lists one line per page, for example:
// - Image    Models > Google [Google - Nano Banana Edit](https://docs.kie.ai/market/google/nano-banana-edit.md): Image editing ...
// Reading the index on each call keeps the list in step with the models Kie adds.
const ENTRY =
  /^- (Image|Video|Music)\s+Models > (.+?) \[(.+?)\]\(https:\/\/docs\.kie\.ai\/([^)]+)\.md\):\s*(.*)$/;

export const kieFindModels: CustomToolEntry = {
  key: 'kie_find_models',
  label: 'Kie Find models',
  description:
    'Find Kie models that generate images, video, music or speech. Returns the title and the docs page of each model. Then call kie_model_docs with the page to get the model id and its input fields.',
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        'Words that must all occur in the model title, family or description, e.g. "nano banana edit" or "text to video". Leave empty to list all models of the type.',
      ),
    type: z.enum(['image', 'video', 'music']).optional().describe('The kind of output.'),
  }),
  execute: async (_credential, input) => {
    const res = await fetch(`${KIE_DOCS}/llms.txt`);
    if (!res.ok) throw new Error(`Kie docs index failed (${res.status})`);
    const words = String(input.query ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const models = [];
    for (const line of (await res.text()).split('\n')) {
      const m = ENTRY.exec(line.trim());
      if (!m) continue;
      const [, kind, family, title, page, about] = m;
      const type = kind.toLowerCase();
      // cn/ pages are Chinese copies, and a callback page describes a webhook, not a model.
      if (page.startsWith('cn/') || /callback/i.test(title)) continue;
      if (input.type && input.type !== type) continue;
      // A page that opens with a ":::warning" block has no summary in the index.
      const description = about.startsWith(':::') ? '' : about;
      const text = `${family} ${title} ${description}`.toLowerCase();
      if (!words.every((w) => text.includes(w))) continue;
      models.push({ type, family, title, page, description });
    }
    return { models };
  },
};
