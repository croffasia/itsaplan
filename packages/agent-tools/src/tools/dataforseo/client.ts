import { z } from 'zod';
import type { ToolConfig } from '../../types';
import { jsonOrThrow } from '../../http';

export const DATAFORSEO_BASE = 'https://api.dataforseo.com/v3';

export const STATUS_OK = 20000;

const DEFAULT_LOCATION = 'United States';
const DEFAULT_LANGUAGE = 'English';

export function dataforseoAuth(credential: ToolConfig): string {
  const pair = `${String(credential.login ?? '')}:${String(credential.password ?? '')}`;
  return `Basic ${Buffer.from(pair).toString('base64')}`;
}

type Status = { status_code?: number; status_message?: string };

function failure(what: string, status: Status | undefined): Error {
  return new Error(`${what} failed (${status?.status_code}): ${status?.status_message}`);
}

// Sends one task and returns the first entry of its result. DataForSEO answers most
// failures with HTTP 200 and puts the error in status_code, for the request and for each
// task.
export async function dataforseoPost<T>(
  credential: ToolConfig,
  path: string,
  task: Record<string, unknown>,
  what: string,
): Promise<T | undefined> {
  const res = await fetch(`${DATAFORSEO_BASE}/${path}`, {
    method: 'POST',
    headers: { Authorization: dataforseoAuth(credential), 'Content-Type': 'application/json' },
    body: JSON.stringify([task]),
  });
  const body = (await jsonOrThrow(res, what)) as Status & {
    tasks?: (Status & { result?: T[] | null })[] | null;
  };
  if (body.status_code !== STATUS_OK) throw failure(what, body);
  const first = body.tasks?.[0];
  if (first?.status_code !== STATUS_OK) throw failure(what, first);
  return first.result?.[0];
}

export const marketInput = {
  location: z
    .string()
    .min(1)
    .optional()
    .describe(`Country by full name, e.g. "United Kingdom". Default: ${DEFAULT_LOCATION}.`),
  language: z
    .string()
    .min(1)
    .optional()
    .describe(`Language by name, e.g. "German". Default: ${DEFAULT_LANGUAGE}.`),
};

export function market(input: Record<string, unknown>): Record<string, string> {
  return {
    location_name: String(input.location ?? DEFAULT_LOCATION),
    language_name: String(input.language ?? DEFAULT_LANGUAGE),
  };
}

export type KeywordData = {
  keyword?: string;
  keyword_info?: {
    search_volume?: number;
    cpc?: number;
    competition_level?: string;
    monthly_searches?: { year: number; month: number; search_volume: number }[];
  };
  keyword_properties?: { keyword_difficulty?: number };
  search_intent_info?: { main_intent?: string };
};

export function keywordMetrics(data: KeywordData | undefined) {
  return {
    keyword: data?.keyword,
    searchVolume: data?.keyword_info?.search_volume,
    cpc: data?.keyword_info?.cpc,
    competition: data?.keyword_info?.competition_level,
    difficulty: data?.keyword_properties?.keyword_difficulty,
    intent: data?.search_intent_info?.main_intent,
  };
}
