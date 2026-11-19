import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWeeklyReport,
  getWeeklyReportSettings,
  saveWeeklyReport,
  setWeeklyReportSettings,
  type WeeklyReportSettings,
} from '@/lib/api/endpoints/weeklyReports';
import { qk } from './queryKeys';

const reportKey = (projectKey: string) => ['weekly-report', projectKey];
const settingsKey = (projectKey: string) => ['weekly-report-settings', projectKey];

export function useWeeklyReportSettings(projectKey: string) {
  return useQuery({
    queryKey: settingsKey(projectKey),
    queryFn: () => getWeeklyReportSettings(projectKey),
  });
}

export function useSetWeeklyReportSettings(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: WeeklyReportSettings) => setWeeklyReportSettings(projectKey, settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(settingsKey(projectKey), settings);
      void queryClient.invalidateQueries({ queryKey: reportKey(projectKey) });
    },
  });
}

export function useWeeklyReport(projectKey: string, open: boolean) {
  return useQuery({
    queryKey: reportKey(projectKey),
    queryFn: () => getWeeklyReport(projectKey),
    enabled: open,
    retry: false,
    staleTime: 0,
  });
}

export function useSaveWeeklyReport(projectKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => saveWeeklyReport(projectKey, token),
    onSuccess: (document) => {
      queryClient.setQueryData(reportKey(projectKey), document);
      void queryClient.invalidateQueries({ queryKey: qk.documentListsForProject(projectKey) });
    },
  });
}
