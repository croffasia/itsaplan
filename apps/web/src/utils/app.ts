import { runtimeEnv } from './runtimeEnv';

// The product name shown to users: the login panel, the passkey label in the OS
// picker, and the account page. It is defined once, so a rebrand is one edit.
export const APP_NAME = "It's a Plan";

// The product site. The product mark on the public share pages links to it.
export const APP_SITE_URL = 'https://itsaplan.dev/';

// The rules a template published to the gallery at itsaplan.dev must follow.
export const TEMPLATE_GALLERY_RULES_URL = 'https://itsaplan.dev/terms#template-gallery';

// The places that link to the Pro page. The site keeps its own list of these values, so a
// new one goes there too.
export type ProFeature =
  | 'agent-analytics'
  | 'agent-budgets'
  | 'agent-tools'
  | 'asana-import'
  | 'audit-log'
  | 'email-domains'
  | 'forms'
  | 'http-tools'
  | 'jira-import'
  | 'portal'
  | 'schedules'
  | 'scim'
  | 'sidebar'
  | 'sso'
  | 'workflows'
  | 'workspace-dashboard'
  | 'workspaces';

// The page about the other editions, linked wherever the app names what they add. The UTM
// tags tell the site which place in the app the visitor came from.
export function proUrl(feature: ProFeature): string {
  const tags = new URLSearchParams({
    utm_source: 'app',
    utm_medium: 'pro_link',
    utm_campaign: feature,
  });
  return `https://itsaplan.dev/pro?${tags}`;
}

// The legal document URLs, linked from the logged-out screens: Google requires the
// privacy policy and terms registered for the OAuth client to be reachable before
// consent is given. Each instance points these at its own documents through its
// environment (see runtimeEnv); when unset, the legal notice is hidden.
export const PRIVACY_POLICY_URL = runtimeEnv().privacyUrl;
export const TERMS_URL = runtimeEnv().termsUrl;
