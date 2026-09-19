import { HttpError } from '../shared/lib';

// Read-through client for the Rinkel telephony API. Nothing about the business
// number is stored here: every read goes straight to Rinkel, so the dashboard can
// never show a stale copy of the call history.
//
// The key is an instance-wide secret in RINKEL_KEY, not a per-project credential,
// because one self-hosted instance serves one Rinkel account.

const BASE_URL = 'https://api.rinkel.com/v1';
const REQUEST_TIMEOUT_MS = 20_000;

export function rinkelConfigured(): boolean {
  return Boolean(process.env.RINKEL_KEY);
}

function apiKey(): string {
  const key = process.env.RINKEL_KEY;
  if (!key) throw new HttpError(503, 'RINKEL_KEY is not set on this instance');
  return key;
}

export async function rinkelGet<T>(
  path: string,
  query: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  // Resolved before the try: a missing key is a configuration problem, not a
  // network one, and must not be reported as "could not reach Rinkel".
  const key = apiKey();

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { 'x-rinkel-api-key': key },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[planner] Rinkel request failed:', err);
    throw new HttpError(502, 'Could not reach Rinkel');
  }

  if (res.status === 401) throw new HttpError(502, 'Rinkel rejected the API key');
  if (res.status === 404) throw new HttpError(404, 'Not found at Rinkel');
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(
      502,
      `Rinkel responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  return (await res.json()) as T;
}

// A write against Rinkel. The endpoints used here answer 204 with no body, so
// nothing is parsed back.
export async function rinkelSend(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<void> {
  const key = apiKey();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        'x-rinkel-api-key': key,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('[planner] Rinkel request failed:', err);
    throw new HttpError(502, 'Could not reach Rinkel');
  }

  if (res.status === 401) throw new HttpError(502, 'Rinkel rejected the API key');
  if (res.status === 404) throw new HttpError(404, 'Not found at Rinkel');
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new HttpError(
      502,
      `Rinkel responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
}

// The shapes below mirror the parts of the Rinkel response the dashboard reads.

export interface RinkelPage<T> {
  data: T[];
  meta?: {
    pagination?: {
      totalItems: number;
      totalPages: number;
      currentPage: number;
      perPage: number;
    };
  };
}

export interface RinkelNumber {
  id: string;
  // Rinkel leaves the label null until someone names the number.
  label: string | null;
  number: string;
  localizedNumber: string;
  status: string;
  activationDate?: string | null;
}

export interface RinkelParty {
  anonymous?: boolean;
  localized?: string;
  e164?: string;
  isOnClientBlacklist?: boolean;
  isOnGlobalBlacklist?: boolean;
}

export interface RinkelInternalNumber {
  id: string;
  label: string | null;
  number: string;
  localizedNumber: string;
}

export interface RinkelCall {
  id: string;
  callId: string;
  date: string;
  direction: 'inbound' | 'outbound';
  externalNumber: RinkelParty | null;
  internalNumber: RinkelInternalNumber | null;
  duration: number;
  status: string;
  missedReason: string | null;
  user: { fullName?: string } | null;
  contact: { fullName?: string; companyName?: string | null } | null;
  voicemail: { id: string; new?: boolean; duration?: number } | null;
  callRecording: { id: string; availableUntil?: string } | null;
  hasNotes?: boolean;
  insights?: { summary?: string; sentiment?: string | null } | null;
}

export interface RinkelStreamUrl {
  data: { url: string };
}

export interface RinkelCount {
  data: { count: number };
}

export interface RinkelNumberDetail {
  data: {
    id: string;
    label: string | null;
    number: string;
    localizedNumber: string;
    status: string;
    insights?: { enabled: boolean };
    dialPlanVersion: number;
    dialPlan?: {
      callRecording?: { enabled: boolean; announcementRecordingId: string | null };
    };
  };
}

export interface RinkelUser {
  id: string;
  fullName: string;
  deviceId: string | null;
}

export interface RinkelTranscription {
  data: { transcription: string; language?: string | null };
}
