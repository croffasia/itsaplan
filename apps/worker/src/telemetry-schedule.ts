// When a pulse is due. Pure, so the rules are unit-tested.

export const MINUTES_PER_DAY = 24 * 60;

export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function minuteOfDay(now: Date): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

// Each instance keeps a slot of its own, so they do not all report at midnight UTC.
export function randomSendMinute(): number {
  return Math.floor(Math.random() * MINUTES_PER_DAY);
}

export interface SendDecision {
  day: string;
  // Null when no pulse was ever accepted.
  lastSentDay: string | null;
  minuteOfDay: number;
  sendMinute: number;
}

export function shouldSend(d: SendDecision): boolean {
  if (d.lastSentDay === d.day) return false;
  // The first pulse ignores the slot: an instance installed and removed within the
  // hour would otherwise never be seen at all.
  if (d.lastSentDay === null) return true;
  return d.minuteOfDay >= d.sendMinute;
}
