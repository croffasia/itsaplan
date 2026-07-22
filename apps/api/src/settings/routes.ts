import { Elysia } from 'elysia';
import { authContext } from '../shared/auth-context';
import { ErrorResponse } from '../shared/responses';
import { getStorageSettings, StorageSettingsSchema } from './storage';
import { getHotkeySettings, HotkeyCombosSchema } from './hotkeys';

// Routes for global instance settings (app_setting): a key-value store not scoped
// to a project. The MCP toggle is per-project (see projects/routes.ts), not here.
//
// Storage limits are readable by any signed-in user, because the upload UI shows
// them before a file is picked. Changing them is god mode (/god/storage-settings).
export const settingsRoutes = new Elysia({
  name: 'settings',
  detail: { tags: ['Settings'] },
})
  .use(authContext)
  .get('/settings/storage', () => getStorageSettings(), {
    response: { 200: StorageSettingsSchema, 401: ErrorResponse },
    detail: {
      summary: 'Get storage limits',
      description: 'Get the instance upload limits the UI shows before a file is picked.',
    },
  })

  .get('/settings/hotkeys', () => getHotkeySettings(), {
    response: { 200: HotkeyCombosSchema, 401: ErrorResponse },
    detail: {
      summary: 'Get instance keyboard shortcuts',
      description:
        'Get the keyboard shortcut overrides that apply to everyone on this instance. Every signed-in user reads them; changing them is god mode.',
    },
  });
