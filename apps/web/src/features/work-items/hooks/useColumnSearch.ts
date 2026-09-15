import { useContext, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ShellCtx } from '@/context/shellContext';
import { ApiError } from '@/lib/api/core/client';
import {
  buildGroups,
  buildMaps,
  groupKeyOf,
  sortIssues,
  type WorkItemsViewProps,
} from '@/utils/project';
import { EMPTY_FILTER_SET, isActiveFilterSet } from '@/utils/filters';
import { issuePath } from '@/utils/paths';
import { useGroupLabels } from '@/hooks/useGroupLabels';
import { useSelection } from '../context/useSelection';
import { columnSearchEntriesForGroup, searchColumnEntries } from '../utils/columnSearch';
import { useColumnSearchState } from './useColumnSearchState';
import { useColumnSearchEntries } from './useColumnSearchEntries';

export function useColumnSearch(props: WorkItemsViewProps, scope: string, pathname: string) {
  const { project, settings, filters, searchSource } = props;
  const state = useColumnSearchState(scope, pathname);
  const { active, close } = state;
  const shell = useContext(ShellCtx);
  const setBoardOverlayOpen = shell?.setBoardOverlayOpen;
  const t = useTranslations('workItems.search');
  const { exclude, clear } = useSelection();
  const labels = useGroupLabels();
  const denied =
    searchSource?.error instanceof ApiError && [401, 403].includes(searchSource.error.status);
  const source = useMemo(
    () => ({ ...project, issues: denied ? [] : (searchSource?.issues ?? []) }),
    [project, denied, searchSource?.issues],
  );
  const identitySource = useMemo(
    () => ({ ...project, issues: denied ? [] : (searchSource?.unfilteredIssues ?? []) }),
    [project, denied, searchSource?.unfilteredIssues],
  );
  const availableGroups = useMemo(
    () => buildGroups(identitySource, settings.group, labels, EMPTY_FILTER_SET),
    [identitySource, settings.group, labels],
  );
  const group = availableGroups.find((candidate) => candidate.key === state.active?.key);
  const groupKey = group?.key;
  const sorted = useMemo(
    () =>
      sortIssues(
        [...source.issues].sort((a, b) => a.position - b.position || a.id - b.id),
        settings.sort,
        source,
      ),
    [source, settings.sort],
  );
  const columnIssues = useMemo(
    () =>
      groupKey ? sorted.filter((issue) => groupKeyOf(issue, settings.group) === groupKey) : [],
    [sorted, groupKey, settings.group],
  );
  const { entries, preparing } = useColumnSearchEntries(
    columnIssues,
    project.customFields,
    state.active != null && !denied,
  );
  const scopedEntries = useMemo(
    () => (groupKey ? columnSearchEntriesForGroup(entries, settings.group, groupKey) : []),
    [entries, groupKey, settings.group],
  );
  const results = useMemo(
    () => searchColumnEntries(scopedEntries, state.matchQuery, project.project.key),
    [scopedEntries, state.matchQuery, project.project.key],
  );
  const maps = useMemo(() => buildMaps(project), [project]);
  const parentById = useMemo(
    () => new Map((shell?.project?.issues ?? project.issues).map((issue) => [issue.id, issue])),
    [shell?.project?.issues, project.issues],
  );
  const laneNames = useMemo(
    () =>
      new Map(
        buildGroups(source, settings.subgroup, labels, filters).map((lane) => [
          lane.key,
          lane.name,
        ]),
      ),
    [source, settings.subgroup, labels, filters],
  );
  const externalOverlayOpen = props.externalOverlayOpen ?? shell?.overlayOpen ?? false;
  const wasOverlayOpen = useRef(externalOverlayOpen);
  const filterKey = JSON.stringify(filters);
  const previousFilterKey = useRef(filterKey);

  useEffect(() => {
    exclude(new Set(columnIssues.map((issue) => issue.id)));
    return () => exclude(new Set());
  }, [exclude, columnIssues]);

  useEffect(() => {
    if (previousFilterKey.current !== filterKey) {
      state.draft.scrollTop = 0;
      state.draft.anchorId = undefined;
      previousFilterKey.current = filterKey;
    }
  }, [filterKey, state.draft]);

  useEffect(() => {
    setBoardOverlayOpen?.(active != null);
    return () => setBoardOverlayOpen?.(false);
  }, [setBoardOverlayOpen, active]);

  useEffect(() => {
    if (active && !group && !searchSource?.loading) {
      close();
      toast.info(t('columnUnavailable'));
    }
  }, [active, group, searchSource?.loading, close, t]);

  useEffect(() => {
    if (
      wasOverlayOpen.current &&
      !externalOverlayOpen &&
      state.active &&
      state.returnToResult.current
    ) {
      requestAnimationFrame(() => {
        if (state.draft.focusedId != null)
          state.resultsRef.current?.focusIssue(state.draft.focusedId);
        else state.inputRef.current?.focus({ preventScroll: true });
      });
    }
    wasOverlayOpen.current = externalOverlayOpen;
  }, [externalOverlayOpen, state]);

  const openIssue = (id: number) => {
    state.draft.focusedId = id;
    state.returnToResult.current = true;
    state.capture();
    props.onOpenIssue(id);
  };

  return {
    ...state,
    group,
    results,
    total: scopedEntries.length,
    maps,
    parentById,
    laneNames,
    project,
    settings,
    loading: !!searchSource?.loading || preparing,
    hasData: !!searchSource?.hasData,
    error: searchSource?.error,
    denied,
    enabled: !!searchSource,
    filtered: isActiveFilterSet(filters),
    filterKey,
    retry: searchSource?.onRetry,
    externalOverlayOpen,
    open: (key: string) => {
      clear();
      state.open(key);
    },
    openIssue,
    issueHref: props.issueHref ?? ((issue) => issuePath(project.project.key, issue.sequenceNumber)),
    viewFilters: props.onViewFilters
      ? () => {
          if (state.active?.mode === 'modal') state.close(false);
          props.onViewFilters?.();
        }
      : undefined,
  };
}
