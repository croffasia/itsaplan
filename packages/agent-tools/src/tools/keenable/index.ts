import type { Integration } from '../../types';
import { keenableSearch } from './search';
import { keenableFetch } from './fetch';

// Keenable's public endpoints need no account or API key, so there is no credential to
// configure.
export const keenable: Integration = {
  key: 'keenable',
  label: 'Keenable',
  credentialSchema: [],
  tools: [keenableSearch, keenableFetch],
};
