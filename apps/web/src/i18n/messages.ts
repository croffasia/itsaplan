import account from '../../messages/en/account.json';
import aiChat from '../../messages/en/aiChat.json';
import apiKeys from '../../messages/en/apiKeys.json';
import auth from '../../messages/en/auth.json';
import common from '../../messages/en/common.json';
import cycles from '../../messages/en/cycles.json';
import dashboards from '../../messages/en/dashboards.json';
import display from '../../messages/en/display.json';
import filters from '../../messages/en/filters.json';
import god from '../../messages/en/god.json';
import inbox from '../../messages/en/inbox.json';
import initiatives from '../../messages/en/initiatives.json';
import invite from '../../messages/en/invite.json';
import issue from '../../messages/en/issue.json';
import issueLinks from '../../messages/en/issueLinks.json';
import mcp from '../../messages/en/mcp.json';
import members from '../../messages/en/members.json';
import meta from '../../messages/en/meta.json';
import nav from '../../messages/en/nav.json';
import newProject from '../../messages/en/newProject.json';
import notes from '../../messages/en/notes.json';
import palette from '../../messages/en/palette.json';
import permissions from '../../messages/en/permissions.json';
import projects from '../../messages/en/projects.json';
import sections from '../../messages/en/sections.json';
import settings from '../../messages/en/settings.json';
import shell from '../../messages/en/shell.json';
import updates from '../../messages/en/updates.json';
import views from '../../messages/en/views.json';
import workItems from '../../messages/en/workItems.json';
import { DEFAULT_LOCALE, type Locale } from './locales';

// English is static: it is the fallback for every other language and the shape the
// `t('…')` keys are typed against.
const defaultMessages = {
  meta,
  auth,
  common,
  nav,
  palette,
  views,
  shell,
  sections,
  issueLinks,
  issue,
  display,
  filters,
  workItems,
  apiKeys,
  invite,
  mcp,
  projects,
  aiChat,
  inbox,
  permissions,
  members,
  cycles,
  dashboards,
  initiatives,
  notes,
  account,
  settings,
  god,
  newProject,
  updates,
};

export type Messages = typeof defaultMessages;

const NAMESPACES = Object.keys(defaultMessages) as (keyof Messages)[];

export async function loadMessages(locale: Locale): Promise<Messages> {
  if (locale === DEFAULT_LOCALE) return defaultMessages;

  const translated = await Promise.all(
    NAMESPACES.map(async (ns) => [
      ns,
      (await import(`../../messages/${locale}/${ns}.json`)).default,
    ]),
  );

  // A key still untranslated renders its English text instead of the raw key path.
  return mergeMessages(defaultMessages, Object.fromEntries(translated)) as Messages;
}

type MessageTree = { [key: string]: string | MessageTree };

function mergeMessages(base: MessageTree, override: MessageTree): MessageTree {
  const result: MessageTree = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    result[key] =
      typeof value === 'object' && typeof current === 'object'
        ? mergeMessages(current, value)
        : value;
  }
  return result;
}
