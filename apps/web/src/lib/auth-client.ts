import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { magicLinkClient, usernameClient } from 'better-auth/client/plugins';
import { passkeyClient } from '@better-auth/passkey/client';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { apiKeyClient } from '@better-auth/api-key/client';
import { API_URL, markSigningOut } from '@/lib/api/core/client';

// better-auth appends its default /api/auth only to a bare origin; an API_URL with a
// path would be used as-is, so the mount is spelled out.
export function authBaseURL(apiUrl: string): string {
  return `${apiUrl.replace(/\/+$/, '')}/api/auth`;
}

// The better-auth handler lives on the backend (Elysia), so baseURL is the API origin.
// inferAdditionalFields declares the custom `role` column added in @repo/auth so the
// session user is typed with it (the web app never imports server packages).
export const authClient = createAuthClient({
  baseURL: authBaseURL(API_URL),
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
    // An MCP client's authorization sends the person to the sign-in and consent
    // screens with a signed request in the URL; this hands it back with every POST
    // they make, so the server can carry on with the authorization.
    oauthProviderClient(),
    // Usernames: signIn.username(). The sign-in screen sends its one field here when
    // what was typed is not an address, and the plugin types `username` on the
    // session user so the profile page can show it.
    usernameClient(),
  ],
});

export const {
  signIn,
  signUp,
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

// Sign out through this wrapper rather than through the client: it tells lib/api
// that the 401s the dropped session causes are expected, so they do not send the
// browser to the expired-session screen.
export async function signOut() {
  markSigningOut();
  return authClient.signOut();
}

export type SessionUser = typeof authClient.$Infer.Session.user;
