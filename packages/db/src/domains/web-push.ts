// The VAPID key pair (RFC 8292) Web Push is sent with, and the contact the push
// services are given, read from the environment. Two processes read it: the api
// (whether push is offered, and the public key a browser subscribes with) and the
// worker, which signs and sends. While any of the three is unset, push is off: the api
// offers it nowhere and queues no push delivery.

export interface WebPushConfig {
  // base64url of the uncompressed P-256 point (65 bytes).
  publicKey: string;
  // base64url of the 32-byte private scalar. Secret.
  privateKey: string;
  // The `sub` claim: a mailto: or https: URI the push services can reach the operator at.
  subject: string;
}

// Read per call rather than at module load, so a test can set the variables around one case.
export function getWebPushConfig(): WebPushConfig | null {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}
