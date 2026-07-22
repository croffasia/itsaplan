// Maps an authenticator AAGUID to the password manager / platform that stores the
// passkey, so two passkeys with the same name are still distinguishable (e.g. one
// in Apple Passwords, one in Google Password Manager). Unknown AAGUIDs show no
// provider. AAGUIDs are public identifiers from the FIDO metadata service.
const AUTHENTICATOR_NAMES: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'Apple Passwords',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  'adce0002-35bc-c60a-648b-0b25f1f05503': 'Chrome on Mac',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
  '9ddd1817-af5a-4672-a2b9-3e3dd95000a7': 'Windows Hello',
  '6028b017-b1d4-4c02-b4b3-afcdafc96bb2': 'Windows Hello',
};

// The label shown for a passkey: the provider when the AAGUID is known, else the
// name the passkey was registered with.
export function passkeyLabel(passkey: { aaguid?: string | null; name?: string | null }): string {
  const provider = passkey.aaguid ? AUTHENTICATOR_NAMES[passkey.aaguid.toLowerCase()] : undefined;
  return provider ?? passkey.name ?? 'Passkey';
}
