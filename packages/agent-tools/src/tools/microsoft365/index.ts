import type { Integration } from '../../types';
import {
  microsoft365FileRead,
  microsoft365FilesList,
  microsoft365FilesSearch,
  microsoft365FileWrite,
  microsoft365SitesSearch,
} from './files';
import { microsoft365MailRead, microsoft365MailSearch, microsoft365MailSend } from './mail';
import { microsoft365CalendarCreate, microsoft365CalendarList } from './calendar';
import { microsoft365TeamsList, microsoft365TeamsMessages } from './teams';

// Microsoft 365: OneDrive and SharePoint files, Outlook mail and calendar, and Teams
// channels, through Microsoft Graph. One credential is one Entra ID app registration
// in the company tenant with application permissions; each tool lists the permission
// it needs, and only the ones granted (with admin consent) work.
export const microsoft365: Integration = {
  key: 'microsoft365',
  label: 'Microsoft 365',
  credentialSchema: [
    {
      key: 'tenantId',
      label: 'Tenant ID',
      type: 'string',
      required: true,
      placeholder: '00000000-0000-0000-0000-000000000000',
      help: 'Directory (tenant) ID, on the Overview page of the app registration in Entra ID (entra.microsoft.com).',
    },
    {
      key: 'clientId',
      label: 'Client ID',
      type: 'string',
      required: true,
      placeholder: '00000000-0000-0000-0000-000000000000',
      help: 'Application (client) ID of the same app registration.',
    },
    {
      key: 'clientSecret',
      label: 'Client secret',
      type: 'secret',
      required: true,
      help: 'A secret value from Certificates & secrets. Under API permissions add the Microsoft Graph application permissions the chosen tools list, then Grant admin consent.',
    },
    {
      key: 'defaultUser',
      label: 'Default user',
      type: 'string',
      required: false,
      placeholder: 'agent@company.com',
      help: 'The mailbox, calendar and OneDrive the tools use when the agent names no user. To keep the app away from other mailboxes, scope it with an Exchange application access policy.',
    },
  ],
  tools: [
    microsoft365FilesSearch,
    microsoft365FilesList,
    microsoft365FileRead,
    microsoft365FileWrite,
    microsoft365SitesSearch,
    microsoft365MailSearch,
    microsoft365MailRead,
    microsoft365MailSend,
    microsoft365CalendarList,
    microsoft365CalendarCreate,
    microsoft365TeamsList,
    microsoft365TeamsMessages,
  ],
};
