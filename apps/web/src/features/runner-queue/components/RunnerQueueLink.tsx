import { useContext, type ComponentProps, type MouseEvent } from 'react';
import Link from 'next/link';
import { RunOpenerCtx } from '../context/runOpenerContext';

// A link to a run. In the side panel a plain click opens the run there; a click that asks
// for a new tab follows the address.
export default function RunnerQueueLink({
  runId,
  ...props
}: ComponentProps<typeof Link> & { runId: number }) {
  const openRun = useContext(RunOpenerCtx);

  function onClick(event: MouseEvent) {
    if (!openRun || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openRun(runId);
  }

  return <Link {...props} onClick={onClick} />;
}
