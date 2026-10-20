import type { ReactNode } from 'react';
import RunnerQueuePage from '@/features/runner-queue/RunnerQueuePage';

// The run list is the layout, so it keeps its scroll and loaded pages while the open run
// changes beside it.
export default function Layout({ children }: { children: ReactNode }) {
  return <RunnerQueuePage>{children}</RunnerQueuePage>;
}
