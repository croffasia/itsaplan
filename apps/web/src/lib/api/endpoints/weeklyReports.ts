import { request } from '@/lib/api/core/client';

export interface WeeklyReportSettings {
  levelOneTypeId: number;
  levelTwoTypeId: number;
  levelThreeTypeId: number;
  levelTwoWeightId: number;
  levelThreeWeightId: number;
  completionRateId: number;
  levelTwoReasonId: number;
  levelThreeReasonId: number;
  timeZone: string;
}

interface ProgressRow {
  id: number;
  title: string;
  progress: number | null;
}

interface SavedReport {
  status: 'saved';
  documentId: number;
}

export type WeeklyReport =
  | { status: 'setup' }
  | SavedReport
  | {
      status: 'preview';
      weekStart: string;
      token: string;
      groups: (ProgressRow & { nodes: (ProgressRow & { reasons: string[] })[] })[];
      warnings: {
        id: number;
        title: string;
        kind:
          | 'noChildren'
          | 'weightTotal'
          | 'invalidWeight'
          | 'invalidRate'
          | 'missingReason'
          | 'unavailableChild';
      }[];
    };

const projectPath = (projectKey: string) => `/projects/${encodeURIComponent(projectKey)}`;

export async function getWeeklyReportSettings(projectKey: string) {
  const response = await request<{ settings: WeeklyReportSettings | null }>(
    `${projectPath(projectKey)}/settings/weekly-report`,
  );
  return response.settings;
}

export function setWeeklyReportSettings(projectKey: string, settings: WeeklyReportSettings) {
  return request<WeeklyReportSettings>(`${projectPath(projectKey)}/settings/weekly-report`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function getWeeklyReport(projectKey: string) {
  return request<WeeklyReport>(`${projectPath(projectKey)}/weekly-report`);
}

export function saveWeeklyReport(projectKey: string, token: string) {
  return request<SavedReport>(`${projectPath(projectKey)}/weekly-report`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
