import { useEffect, useState } from 'react';
import { formatRunDuration } from '@/utils/formatRunDuration';

// How long a running run has run so far, counted each second.
export default function RunnerQueueRunElapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return <span className="tabular-nums">{formatRunDuration(now - Date.parse(since))}</span>;
}
