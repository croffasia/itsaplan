// The product name shown to users: the login panel, the passkey label in the OS
// picker, and the account page. Single source so a rebrand is one edit.
export const APP_NAME = "It's a Plan";

// The legal document URLs, linked from the logged-out screens: Google requires the
// privacy policy and terms registered for the OAuth client to be reachable before
// consent is given. Each instance points these at its own documents through
// apps/web/.env (build-time, inlined into the bundle); when unset, the legal notice
// is hidden.
export const PRIVACY_POLICY_URL = process.env.NEXT_PUBLIC_PRIVACY_URL ?? '';
export const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_URL ?? '';
