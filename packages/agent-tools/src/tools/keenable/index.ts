import type { Integration } from '../../types';
import { keenableSearch } from './search';
import { keenableFetch } from './fetch';
import { keenableIcon } from './icon';
import { verifyKeenable } from './verify';

// Keenable's public endpoints need no key: they allow 1,000 calls an hour per IP address,
// shared with all other traffic from it. A key lifts the hourly cap and is billed in
// credits, with a free monthly allowance.
export const keenable: Integration = {
  key: 'keenable',
  label: 'Keenable',
  icon: keenableIcon,
  website: 'https://keenable.ai',
  credentialSchema: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'secret',
      required: true,
      placeholder: 'keen_...',
      help: 'Lifts the keyless limit of 1,000 calls an hour per IP address and includes 100,000 free calls a month. Create a key in the [Keenable console](https://app.keenable.ai/console/api-keys).',
    },
  ],
  credentialOptional: true,
  verify: verifyKeenable,
  tools: [keenableSearch, keenableFetch],
};
