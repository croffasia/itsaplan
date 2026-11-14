import type { Integration } from '../../types';
import { firecrawlScrape } from './scrape';
import { firecrawlMap } from './map';
import { firecrawlSearch } from './search';
import { firecrawlCrawl } from './crawl';
import { firecrawlExtract } from './extract';
import { firecrawlIcon } from './icon';
import { verifyFirecrawl } from './verify';

// Firecrawl: web scraping, crawling, mapping, search, and structured extraction.
export const firecrawl: Integration = {
  key: 'firecrawl',
  label: 'Firecrawl',
  credentialSchema: [
    { key: 'apiKey', label: 'API key', type: 'secret', required: true, placeholder: 'fc-...' },
  ],
  icon: firecrawlIcon,
  website: 'https://www.firecrawl.dev',
  verify: verifyFirecrawl,
  tools: [firecrawlScrape, firecrawlMap, firecrawlSearch, firecrawlCrawl, firecrawlExtract],
};
