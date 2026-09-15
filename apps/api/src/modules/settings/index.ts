import { Elysia } from 'elysia';
import { requireUser } from '#shared/access';
import { authContext } from '#shared/auth-context';
import { errors } from '#shared/responses';
import { getStorageSettings } from '@repo/db';
import { getHotkeySettings } from './service';
import { getAppVersion } from './updates';
import { getWhatsNew, markWhatsNewSeen } from './whats-new';
import {
  HotkeyCombosSchema,
  StorageSettingsSchema,
  VersionResponse,
  WhatsNewSchema,
} from './model';

// Routes for global instance settings (app_setting): a key-value store not scoped
// to a project. The MCP toggle is per-project (see modules/projects), not here.
//
// Storage limits are readable by any signed-in user, because the upload UI shows
// them before a file is picked. Changing them is god mode (/god/storage-settings).
export const settingsRoutes = new Elysia({
  name: 'settings',
  detail: { tags: ['Settings'] },
})
  .use(authContext)
  .get('/settings/storage', () => getStorageSettings(), {
    response: { 200: StorageSettingsSchema, ...errors(401) },
    detail: {
      summary: 'Get storage limits',
      description: 'Get the instance upload limits the UI shows before a file is picked.',
    },
  })

  .get('/settings/hotkeys', () => getHotkeySettings(), {
    response: { 200: HotkeyCombosSchema, ...errors(401) },
    detail: {
      summary: 'Get instance keyboard shortcuts',
      description:
        'Get the keyboard shortcut overrides that apply to everyone on this instance. Every signed-in user reads them; changing them is god mode.',
    },
  })

  // The running version, shown in the sidebar to everyone. Whether a newer one
  // exists is god mode (/god/updates), and so is the release history. A session is
  // required: the version tells an anonymous visitor which release to look up
  // vulnerabilities for.
  .get('/settings/version', () => ({ version: getAppVersion() }), {
    response: { 200: VersionResponse, ...errors(401) },
    detail: {
      summary: 'Get the running version',
      description: 'Get the version of the app this instance runs.',
    },
  })

  // What the running release brought, plus — for the instance owner — the
  // pre-migration database dump and what the migrations did to the instance's data.
  // The notes come from the release feed merged over the shipped changelog; the feed
  // is cached, so a session rarely waits on it.
  .get('/settings/whats-new', ({ user }) => getWhatsNew(requireUser(user)), {
    response: { 200: WhatsNewSchema, ...errors(401) },
    detail: {
      summary: "Get the release's what's-new screen",
      description:
        "Get the running release's notes and, for an administrator, the backup taken before its migrations and the report of what they changed. `pending` is false once this user has closed the screen for this version.",
    },
  })

  .post(
    '/settings/whats-new/seen',
    async ({ user }) => {
      await markWhatsNewSeen(requireUser(user).id);
      return { version: getAppVersion() };
    },
    {
      response: { 200: VersionResponse, ...errors(401) },
      detail: {
        summary: "Close the what's-new screen",
        description: 'Record that this user has seen the screen for the running version.',
      },
    },
  );
