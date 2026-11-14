// Prints a new VAPID key pair for Web Push as .env lines: `bun run web-push:keys`. The api
// and the worker read them. Push stays off until WEB_PUSH_SUBJECT is set as well, to a
// mailto: or https: contact the push services can reach. A new pair on a running
// instance ends every subscription made with the old one.

const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair;
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey));
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey);

console.log(`WEB_PUSH_VAPID_PUBLIC_KEY=${publicKey.toString('base64url')}`);
console.log(`WEB_PUSH_VAPID_PRIVATE_KEY=${d}`);
console.log('# WEB_PUSH_SUBJECT=mailto:admin@example.com');
