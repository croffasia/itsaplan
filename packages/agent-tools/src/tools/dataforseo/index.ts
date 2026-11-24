import type { Integration } from '../../types';
import { dataforseoSerp } from './serp';
import { dataforseoKeywordOverview } from './keyword-overview';
import { dataforseoKeywordIdeas } from './keyword-ideas';
import { dataforseoRankedKeywords } from './ranked-keywords';
import { dataforseoCompetitors } from './competitors';
import { dataforseoBacklinks } from './backlinks';
import { dataforseoPageAudit } from './page-audit';
import { dataforseoIcon } from './icon';
import { verifyDataforseo } from './verify';

// DataForSEO bills every call to the account's prepaid balance.
export const dataforseo: Integration = {
  key: 'dataforseo',
  label: 'DataForSEO',
  description: 'Gets search results, keyword data, backlinks and page audits for SEO.',
  icon: dataforseoIcon,
  // The project's partner link: an account opened through it supports the project.
  website: 'https://try.dataforseo.com/49wtthgg2yk6',
  credentialSchema: [
    {
      key: 'login',
      label: 'API login',
      type: 'string',
      required: true,
      help: 'Find it on the API Access page of your DataForSEO dashboard. No account yet? [Sign up at DataForSEO](https://try.dataforseo.com/49wtthgg2yk6).',
    },
    {
      key: 'password',
      label: 'API password',
      type: 'secret',
      required: true,
      help: 'Find it on the API Access page of your DataForSEO dashboard. It differs from the password you sign in with.',
    },
  ],
  verify: verifyDataforseo,
  tools: [
    dataforseoSerp,
    dataforseoKeywordOverview,
    dataforseoKeywordIdeas,
    dataforseoRankedKeywords,
    dataforseoCompetitors,
    dataforseoBacklinks,
    dataforseoPageAudit,
  ],
};
