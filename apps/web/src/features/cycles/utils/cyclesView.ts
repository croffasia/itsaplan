import { isCyclesView, type CyclesView } from '@/utils/paths';

// Which layout the cycles list opens in, remembered per project. Client-only:
// localStorage is what the list path reads to pick a layout (see CyclesRedirect),
// and what switching a tab writes.

const storageKey = (projectKey: string) => `cycles-view:${projectKey}`;

export function readCyclesView(projectKey: string): CyclesView {
  try {
    const stored = localStorage.getItem(storageKey(projectKey));
    return stored && isCyclesView(stored) ? stored : 'table';
  } catch {
    return 'table';
  }
}

export function rememberCyclesView(projectKey: string, view: CyclesView) {
  try {
    localStorage.setItem(storageKey(projectKey), view);
  } catch {
    // ignore write failures (private mode / quota); the layout still switches.
  }
}
