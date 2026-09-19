import type { PhoneCall } from '@/lib/api';

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${String(rest).padStart(2, '0')}s` : `${rest}s`;
}

// Who the call was with. An anonymous caller withholds the number, and a known
// contact is worth more than the digits.
export function callerLabel(call: PhoneCall): string {
  if (call.contactName) return call.contactName;
  if (call.anonymous) return 'Anonymous';
  return call.externalNumber ?? 'Unknown';
}

export const STATUS_LABELS: Record<string, string> = {
  ANSWERED: 'Answered',
  MISSED: 'Missed',
  VOICEMAIL: 'Voicemail',
  ANSWERING_SERVICE: 'Answering service',
};

export const MISSED_REASONS: Record<string, string> = {
  NO_ANSWER: 'no answer',
  BLOCKED: 'blocked',
  OUTSIDE_BUSINESS_HOURS: 'outside business hours',
};

export const STATUS_FILTERS = [
  { value: 'all', label: 'All calls' },
  { value: 'ANSWERED', label: 'Answered' },
  { value: 'MISSED', label: 'Missed' },
  { value: 'VOICEMAIL', label: 'Voicemail' },
];

export const DIRECTION_FILTERS = [
  { value: 'all', label: 'Both directions' },
  { value: 'inbound', label: 'Incoming' },
  { value: 'outbound', label: 'Outgoing' },
];
