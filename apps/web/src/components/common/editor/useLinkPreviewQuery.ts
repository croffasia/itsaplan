import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { resolveLinkPreview } from './resolveLinkPreview';
import { linkPreviewDestination } from './linkPreviewDestination';

async function preloadImage(src: string, signal: AbortSignal) {
  await new Promise<void>((resolve) => {
    const image = new Image();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      image.onload = null;
      image.onerror = null;
      if (signal.aborted) image.removeAttribute('src');
      resolve();
    };
    const timer = setTimeout(finish, 800);
    image.referrerPolicy = 'no-referrer';
    image.onload = finish;
    image.onerror = finish;
    signal.addEventListener('abort', finish, { once: true });
    image.src = src;
  });
}

export function useLinkPreviewQuery(url: string | undefined) {
  const { data: session, isPending: sessionPending } = useSession();
  const origin = typeof window === 'undefined' ? undefined : window.location.origin;
  const destination = url ? linkPreviewDestination(url, origin) : null;
  const href = destination?.href;
  const internal = !!destination && destination.origin === origin;
  const enabled = !!href && !!session?.user.id && !sessionPending;
  const queryKey = ['link-preview', session?.user.id, href];
  if (internal) queryKey.push(session?.session?.id);
  const query = useQuery({
    queryKey,
    enabled,
    queryFn: async ({ signal }) => {
      const preview = await resolveLinkPreview(href!, window.location.origin, signal);
      if (preview.image && !signal.aborted) {
        await preloadImage(preview.image, signal);
      }
      signal.throwIfAborted();
      return preview;
    },
    staleTime: (query) => {
      if (internal) return 0;
      const preview = query.state.data;
      return preview?.title || preview?.description || preview?.image || preview?.siteName
        ? 5 * 60_000
        : 15_000;
    },
    gcTime: internal ? 0 : 2 * 60_000,
    retry: false,
    refetchOnMount: internal ? 'always' : true,
    refetchOnWindowFocus: false,
  });
  return {
    ...query,
    data:
      !enabled || query.isError || (internal && query.fetchStatus !== 'idle')
        ? undefined
        : query.data,
    isPending:
      sessionPending ||
      (enabled && (query.isPending || (internal && query.fetchStatus !== 'idle'))),
  };
}
