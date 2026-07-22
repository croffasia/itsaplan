import type { Integration } from '../../types';
import { jinaReader } from './reader';
import { jinaSearch } from './search';
import { jinaDeepSearch } from './deepsearch';
import { jinaGrounding } from './grounding';
import { jinaRerank } from './rerank';
import { jinaClassify } from './classify';
import { jinaSegment } from './segment';

// Jina AI: a family of web/search/text tools that share one API key.
export const jina: Integration = {
  key: 'jina',
  label: 'Jina AI',
  credentialSchema: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'secret',
      required: true,
      placeholder: 'jina_...',
      help: 'One key for all Jina tools. Get a free key at jina.ai.',
    },
  ],
  tools: [
    jinaReader,
    jinaSearch,
    jinaDeepSearch,
    jinaGrounding,
    jinaRerank,
    jinaClassify,
    jinaSegment,
  ],
};
