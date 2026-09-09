// Ceilings on the invite emails one instance sends on a member's behalf. The email
// leaves from the instance's own mail domain, so without them a single account could
// use the instance as a relay for unsolicited mail.
export interface InviteThrottle {
  // How long one invite waits before its email may be queued again.
  emailCooldownMs: number;
  // Invites one account may create in a rolling hour, across every team and project.
  maxCreatesPerHour: number;
}

const DEFAULTS: InviteThrottle = {
  emailCooldownMs: 10 * 60 * 1000,
  maxCreatesPerHour: 30,
};

let current: InviteThrottle = DEFAULTS;

// Test-only: installs ceilings on top of the defaults. Process-wide, so a test that
// sets one restores it with resetInviteThrottle in an afterEach.
export function setInviteThrottle(overrides: Partial<InviteThrottle>): void {
  current = { ...DEFAULTS, ...overrides };
}

export function resetInviteThrottle(): void {
  current = DEFAULTS;
}

export function inviteThrottle(): InviteThrottle {
  return current;
}
