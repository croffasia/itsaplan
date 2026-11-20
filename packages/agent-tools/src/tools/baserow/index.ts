import type { Integration } from '../../types';
import { baserowListTables } from './list-tables';
import { baserowListFields } from './list-fields';
import { baserowListRows } from './list-rows';
import { baserowGetRow } from './get-row';
import { baserowCreateRows } from './create-rows';
import { baserowUpdateRows } from './update-rows';
import { baserowDeleteRows } from './delete-rows';
import { baserowIcon } from './icon';
import { verifyBaserow } from './verify';

// Baserow: the rows of database tables an agent can read and change. One credential is
// one database token on Baserow Cloud or on a self-hosted instance, and it reaches only
// the tables and the operations it was granted.
export const baserow: Integration = {
  key: 'baserow',
  label: 'Baserow',
  description: 'Reads, creates, updates and deletes rows in Baserow tables.',
  credentialSchema: [
    {
      key: 'baseUrl',
      label: 'Instance URL',
      type: 'url',
      required: false,
      placeholder: 'https://baserow.io',
      help: 'Leave empty for Baserow Cloud. For a self-hosted Baserow, the address of your instance, such as https://baserow.example.com.',
    },
    {
      key: 'token',
      label: 'Database token',
      type: 'secret',
      required: true,
      help: 'A database token from Baserow (My settings, Database tokens). It reaches the tables of one workspace. In its permissions, choose the tables for each action: create, read, update and delete rows.',
    },
  ],
  icon: baserowIcon,
  website: 'https://baserow.io',
  verify: verifyBaserow,
  tools: [
    baserowListTables,
    baserowListFields,
    baserowListRows,
    baserowGetRow,
    baserowCreateRows,
    baserowUpdateRows,
    baserowDeleteRows,
  ],
};
