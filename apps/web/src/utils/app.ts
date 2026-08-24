// The product name shown to users: the login panel, the passkey label in the OS
// picker, and the account page. It is defined once, so a rebrand is one edit.
export const APP_NAME = "It's a Plan";

// The product site. The product mark on the public share pages links to it.
export const APP_SITE_URL = 'https://itsaplan.dev/';

// The legal document URLs, linked from the logged-out screens. Google requires the
// privacy policy and the terms registered for the OAuth client to be reachable
// before a user gives consent. Each instance points these at its own documents
// through apps/web/.env (build-time, inlined into the bundle). When they are unset,
// the legal notice is hidden.
export const PRIVACY_POLICY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL ?? '';
export const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL ?? '';
