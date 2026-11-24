// Frontend origins allowed to call the auth handler. Mandatory config: cookies, the
// WebAuthn relying party and the cookie domain are all derived from it, so a deploy
// that misses it has to fail at startup instead of running on a localhost default.
export const trustedOrigins = (process.env.APP_URL ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
if (trustedOrigins.length === 0) {
  throw new Error('APP_URL is not set: public origin(s) of the web app.');
}
