import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { magicLinkClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { apiKeyClient } from '@better-auth/api-key/client';
import { API_URL } from '@/lib/api';

// The better-auth handler lives on the backend (Elysia), so baseURL is the API origin.
// inferAdditionalFields declares the custom `role` column added in @repo/auth so the
// session user is typed with it (the web app never imports server packages).
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        // Server-assigned (see @repo/auth) — not part of the sign-up input.
        role: { type: 'string', input: false },
      },
    }),
    // WebAuthn passkeys: signIn.passkey() and passkey.addPasskey().
    passkeyClient(),
    // Personal API keys: apiKey.create()/list()/delete().
    apiKeyClient(),
    // Sign-in by emailed link: signIn.magicLink(). Whether it is offered is an
    // instance setting the sign-in screen reads from /auth-config; the server
    // refuses to send when it is off.
    magicLinkClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  passkey,
  apiKey,
  updateUser,
  changePassword,
  // Password reset by email: request sends the link, reset consumes its token.
  requestPasswordReset,
  resetPassword,
  // Resends the address confirmation link.
  sendVerificationEmail,
  // Connected sign-in providers, managed on the account's Accounts page.
  listAccounts,
  linkSocial,
  unlinkAccount,
} = authClient;

export type SessionUser = typeof authClient.$Infer.Session.user;
