import { HttpError } from '#shared/lib';
import type { CopyIdMaps } from '#modules/projects/copy';

// What an extension of the api installs into agent schedules: types of its own beside
// 'cron' and 'status', the options it keeps on a schedule, and which issues start a
// schedule's runs. A self-hosted instance installs none of them: it has the two core
// types, a schedule holds no options, and every issue starts a run.

export type ScheduleOptions = Record<string, unknown>;

export interface ScheduleForExtension {
  id: number;
  agentId: number;
  projectId: number;
  type: string;
  options: ScheduleOptions;
}

let extraTypes: string[] = [];

// A schedule of an added type takes no cron and no column, and nothing in the core
// starts it: the extension queues its runs with queueScheduleRuns (./issue-runs).
export function setScheduleTypes(types: string[] = []): void {
  extraTypes = types;
}

export function isScheduleType(type: string): boolean {
  return type === 'cron' || type === 'status' || extraTypes.includes(type);
}

export interface ScheduleOptionsInput {
  type: string;
  options: ScheduleOptions;
  projectId: number;
  // Set when a project copy re-creates the schedule: the old → new ids of what the copy
  // re-created, for the ids the options hold.
  copy?: CopyIdMaps;
}

// A copy keeps the options of the source, so a project copied after the extension is
// removed still copies.
async function noOptions({ options, copy }: ScheduleOptionsInput): Promise<ScheduleOptions> {
  if (!copy && Object.keys(options).length > 0) {
    throw new HttpError(400, 'This instance takes no schedule options');
  }
  return options;
}

let optionsCheck = noOptions;

// Checks the options a write sets and returns them as stored; throws an HttpError to
// refuse them.
export function setScheduleOptionsCheck(next = noOptions): void {
  optionsCheck = next;
}

export function checkScheduleOptions(input: ScheduleOptionsInput): Promise<ScheduleOptions> {
  return optionsCheck(input);
}

type IssueFilter = (schedule: ScheduleForExtension, issueIds: number[]) => Promise<number[]>;

const everyIssue: IssueFilter = async (_schedule, issueIds) => issueIds;

let issueFilter = everyIssue;

// Returns which of the issues start a run of the schedule. Asked before every run a
// schedule queues on issues.
export function setScheduleIssueFilter(next = everyIssue): void {
  issueFilter = next;
}

export function filterScheduleIssues(
  schedule: ScheduleForExtension,
  issueIds: number[],
): Promise<number[]> {
  return issueFilter(schedule, issueIds);
}
