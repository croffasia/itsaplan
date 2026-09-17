import { useRouter } from 'next/navigation';
import { issuePath } from '@/utils/paths';

// Warms the issue page on hover so opening it (panel expand or "Go to issue")
// hits a prefetched shell instead of a cold navigation.
export function usePrefetchIssue(projectKey: string, sequenceNumber: number) {
  const router = useRouter();
  return () => {
    router.prefetch(issuePath(projectKey, sequenceNumber));
  };
}
