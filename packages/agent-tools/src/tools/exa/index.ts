import type { IntegrationListing } from '../../types';
import { exaIcon } from './icon';

// Exa runs in another edition of the app. The core lists it locked, and that edition builds
// the integration on this listing (lockedListing), so the names and descriptions are kept
// here alone.
export const exa: IntegrationListing = {
  key: 'exa',
  label: 'Exa',
  description: 'Searches the web, reads pages and answers questions with sources.',
  icon: exaIcon,
  website: 'https://exa.ai',
  credentialSchema: [
    {
      key: 'apiKey',
      label: 'API key',
      type: 'secret',
      required: true,
      help: 'Create a key in the [Exa dashboard](https://dashboard.exa.ai/api-keys). Each call is paid from your Exa credits; the free plan adds $10 of them every month.',
    },
  ],
  tools: [
    {
      key: 'exa_search',
      label: 'Exa Search',
      description:
        'Search the web with Exa and return the top results with title, URL and publication date, and on request the text, the passages that answer a question, or a summary of each page. Filters by domain, category and publication date. The deep type searches longer for questions a quick search does not answer.',
    },
    {
      key: 'exa_contents',
      label: 'Exa Contents',
      description:
        'Read web pages by URL with Exa and return the text of each, the passages that answer a question, or a summary. Use it for pages a search found or a person linked.',
    },
    {
      key: 'exa_answer',
      label: 'Exa Answer',
      description:
        'Answer a question with Exa: it searches the web and returns a short answer with the pages it cites. Use it for a factual question that needs current information.',
    },
  ],
};
