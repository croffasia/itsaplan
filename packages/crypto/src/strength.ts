// Strength check for the secrets read from env (the session signing secret, the token
// the worker and the bot authenticate with). An example value passes the compose
// `${VAR:?}` guard, which only rejects an empty one, so the check is repeated here at
// startup and the process refuses to run on a secret anyone can read from the repo.

const MIN_BYTES = 32;

// Example values that are long enough to pass the length check: the one this repo's
// .env.example shipped, and better-auth's own fallback secret.
const EXAMPLE_SECRETS = new Set([
  'change-me-please-generate-a-real-secret',
  'better-auth-secret-12345678901234567890',
]);

// Why the value is not acceptable as a secret, or null when it is.
export function weakSecretReason(value: string | undefined): string | null {
  if (!value) return 'is not set';
  if (EXAMPLE_SECRETS.has(value)) return 'is an example value';
  if (Buffer.byteLength(value, 'utf8') < MIN_BYTES) return `is shorter than ${MIN_BYTES} bytes`;
  return null;
}

// Returns the value when it is acceptable; throws otherwise, naming the variable.
export function assertStrongSecret(name: string, value: string | undefined): string {
  const reason = weakSecretReason(value);
  if (reason) {
    throw new Error(`${name} ${reason}: generate one with \`openssl rand -base64 32\`.`);
  }
  return value as string;
}
