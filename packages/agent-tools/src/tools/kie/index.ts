import type { Integration } from '../../types';
import { kieFindModels } from './find-models';
import { kieModelDocs } from './model-docs';
import { kieCreateTask } from './create-task';
import { kieGetTask } from './get-task';
import { kieCredits } from './credits';
import { kieIcon } from './icon';
import { verifyKie } from './verify';

// The partner link: every link to the site carries it.
const SITE = 'https://kie.ai?ref=0b6eb19939298accdf58e18b1a92a26e';

// The tools find a model in the Kie docs, read its input fields, and run it as a task,
// so a model Kie adds needs no change here.
export const kie: Integration = {
  key: 'kie',
  label: 'Kie',
  description:
    'Generates images, video, music and speech with Nano Banana, Veo, Kling, Suno and other models.',
  icon: kieIcon,
  website: SITE,
  credentialSchema: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'secret',
      required: true,
      help: `Create it on the API Keys page of your Kie account. All models spend credits from one balance. No account yet? [Sign up at Kie](${SITE}).`,
    },
  ],
  verify: verifyKie,
  tools: [kieFindModels, kieModelDocs, kieCreateTask, kieGetTask, kieCredits],
};
