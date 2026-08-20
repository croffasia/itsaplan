import type { Integration } from '../../types';
import { notionSearch } from './search';
import { notionReadPage } from './read-page';
import { notionCreatePage } from './create-page';
import { notionUpdatePage } from './update-page';
import { notionReadComments } from './read-comments';
import { notionAddComment } from './add-comment';

// Notion: pages an agent can find, read, write and discuss. One credential is one
// Notion integration token, and it reaches only the pages a person shared with it.
export const notion: Integration = {
  key: 'notion',
  label: 'Notion',
  credentialSchema: [
    {
      key: 'token',
      label: 'API token',
      type: 'secret',
      required: true,
      placeholder: 'ntn_...',
      help: 'The token of a Notion integration (app.notion.com/developers/connections); a workspace or a personal one both work. Each page the agent should reach must then be shared with that integration in Notion: open the page, "..." menu, Connections, add it. A page that is not connected stays invisible.',
    },
  ],
  tools: [
    notionSearch,
    notionReadPage,
    notionCreatePage,
    notionUpdatePage,
    notionReadComments,
    notionAddComment,
  ],
};
