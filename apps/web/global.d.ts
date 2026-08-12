import type { Messages } from './src/i18n/messages';

// Types every translation key against the English catalogue: a `t('…')` for a key
// that does not exist there fails typecheck instead of rendering the key path.
declare module 'next-intl' {
  interface AppConfig {
    Messages: Messages;
  }
}
