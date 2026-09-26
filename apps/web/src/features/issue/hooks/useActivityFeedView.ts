import { useCallback, useEffect, useState } from 'react';
import type { FeedFilter, FeedOrder } from '@/lib/api/endpoints/activity';
import {
  useAccountPreferencesQuery,
  useUpdateAccountPreferences,
} from '@/services/preferences.service';
import type { FeedSlice } from '../services/comments.service';

export type ActivityTab = 'all' | FeedFilter;

const TABS: ActivityTab[] = ['all', 'comments', 'history', 'worklog'];
const TAB_KEY = 'issue-activity-tab';
const ORDER_KEY = 'issue-activity-order';

// How the activity log of every issue is shown: the tab and the order are the last
// ones picked in this browser, and grouping by status is the account preference, so
// switching it here changes it on the preferences page too.
//
// The stored values are read in an effect, not in the state initializer: the
// initializer also runs during the server render, where there is no localStorage.
// `ready` stays false until they and the preferences are read, so the feed never
// fetches a default page it then throws away.
export function useActivityFeedView() {
  const [stored, setStored] = useState<{ tab: ActivityTab; order: FeedOrder } | null>(null);
  const preference = useAccountPreferencesQuery().data?.issueActivityView;
  const { mutate } = useUpdateAccountPreferences();

  useEffect(() => {
    const tab = read(TAB_KEY);
    setStored({
      tab: TABS.includes(tab as ActivityTab) ? (tab as ActivityTab) : 'all',
      order: read(ORDER_KEY) === 'asc' ? 'asc' : 'desc',
    });
  }, []);

  const setTab = useCallback((tab: ActivityTab) => {
    write(TAB_KEY, tab);
    setStored((prev) => prev && { ...prev, tab });
  }, []);

  const setOrder = useCallback((order: FeedOrder) => {
    write(ORDER_KEY, order);
    setStored((prev) => prev && { ...prev, order });
  }, []);

  const setGrouped = useCallback(
    (grouped: boolean) => mutate({ issueActivityView: grouped ? 'grouped' : 'flat' }),
    [mutate],
  );

  const tab = stored?.tab ?? 'all';
  const order = stored?.order ?? 'desc';
  const slice: FeedSlice = { filter: tab === 'all' ? null : tab, order };
  return {
    ready: stored != null && preference != null,
    tab,
    order,
    slice,
    grouped: preference === 'grouped',
    setTab,
    setOrder,
    setGrouped,
  };
}

export type ActivityFeedView = ReturnType<typeof useActivityFeedView>;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore write failures (private mode / quota); the view still switches.
  }
}
