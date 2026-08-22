import { Elysia } from 'elysia';
import { authContext } from '#shared/auth-context';
import { errors } from '#shared/responses';
import { getStorageSettings, getHotkeySettings } from './service';
import { getAppVersion } from './updates';
import { HotkeyCombosSchema, StorageSettingsSchema, VersionResponse } from './model';

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
  });
