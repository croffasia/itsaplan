import { useSyncExternalStore } from 'react';

const KEY = 'planner_inbox_all_projects';
const EVENT = 'planner-inbox-scope-changed';

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function snapshot() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function useInboxScope() {
  const allProjects = useSyncExternalStore(subscribe, snapshot, () => false);
  const setAllProjects = (enabled: boolean) => {
    try {
      window.localStorage.setItem(KEY, String(enabled));
    } catch {
      // Without storage the default project scope remains in effect.
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { allProjects, setAllProjects };
}
