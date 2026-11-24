import { createContext } from 'react';

// How the side panel opens a run, set over its list and its run. Without it a run opens
// at its address.
export const RunOpenerCtx = createContext<((runId: number) => void) | null>(null);
