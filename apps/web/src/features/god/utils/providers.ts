// Sign-in method labels. better-auth stores the password provider as "credential";
// anything else is a social or passkey provider and keeps its own id.
const PROVIDER_LABELS: Record<string, string> = {
  credential: 'Password',
  google: 'Google',
  passkey: 'Passkey',
};

const providerLabel = (id: string) => PROVIDER_LABELS[id] ?? id;

export const providerList = (ids: string[]) => ids.map(providerLabel).join(', ');
