import type { RinkelCall, RinkelNumber } from './client';
import { matchContact, type PhoneContactMatch } from './store';

// Rinkel's own shapes flattened into what the dashboard shows. Doing it here keeps
// the provider's field names out of the frontend.

export interface CallDto {
  id: string;
  callId: string;
  date: string;
  direction: string;
  status: string;
  missedReason: string | null;
  duration: number;
  // Who called in, or who was called. Anonymous callers withhold the number.
  externalNumber: string | null;
  anonymous: boolean;
  blocked: boolean;
  // Which of the business numbers the call ran over.
  internalNumber: string | null;
  internalLabel: string | null;
  contactName: string | null;
  userName: string | null;
  recordingId: string | null;
  voicemailId: string | null;
  voicemailNew: boolean;
  hasNotes: boolean;
  sentiment: string | null;
  summary: string | null;
  // The CRM customer whose phone number matches the caller, when there is one.
  crmCustomerId: string | null;
  crmCustomerName: string | null;
}

export interface NumberDto {
  id: string;
  label: string | null;
  number: string;
  status: string;
}

function contactName(call: RinkelCall): string | null {
  const contact = call.contact;
  if (!contact) return null;
  return contact.fullName || contact.companyName || null;
}

export function callDto(call: RinkelCall, crmIndex: PhoneContactMatch[] = []): CallDto {
  const external = call.externalNumber;
  const number = external?.localized || external?.e164 || null;
  const match = external?.anonymous ? null : matchContact(number, crmIndex);
  return {
    id: call.id,
    callId: call.callId,
    date: call.date,
    direction: call.direction,
    status: call.status,
    missedReason: call.missedReason ?? null,
    duration: call.duration ?? 0,
    externalNumber: number,
    anonymous: external?.anonymous ?? false,
    blocked: Boolean(external?.isOnClientBlacklist || external?.isOnGlobalBlacklist),
    internalNumber: call.internalNumber?.localizedNumber || call.internalNumber?.number || null,
    internalLabel: call.internalNumber?.label ?? null,
    contactName: contactName(call),
    userName: call.user?.fullName ?? null,
    recordingId: call.callRecording?.id ?? null,
    voicemailId: call.voicemail?.id ?? null,
    voicemailNew: call.voicemail?.new ?? false,
    hasNotes: call.hasNotes ?? false,
    sentiment: call.insights?.sentiment ?? null,
    summary: call.insights?.summary ?? null,
    crmCustomerId: match?.customerId ?? null,
    crmCustomerName: match?.name ?? null,
  };
}

export function numberDto(row: RinkelNumber): NumberDto {
  return {
    id: row.id,
    label: row.label ?? null,
    number: row.localizedNumber || row.number,
    status: row.status,
  };
}

export interface CallStats {
  total: number;
  inbound: number;
  answered: number;
  missed: number;
  voicemail: number;
  averageDuration: number;
}

// The counters above the call list, derived from the calls in the window the page
// asked for rather than from a separate Rinkel call.
export function callStats(calls: CallDto[]): CallStats {
  const answered = calls.filter((call) => call.status === 'ANSWERED');
  const totalDuration = answered.reduce((sum, call) => sum + call.duration, 0);
  return {
    total: calls.length,
    inbound: calls.filter((call) => call.direction === 'inbound').length,
    answered: answered.length,
    missed: calls.filter((call) => call.status === 'MISSED').length,
    voicemail: calls.filter((call) => call.status === 'VOICEMAIL').length,
    averageDuration: answered.length > 0 ? Math.round(totalDuration / answered.length) : 0,
  };
}
