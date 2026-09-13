import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { resolveLinkPreview } from './resolveLinkPreview';

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
  const internal =
    !!url && typeof window !== 'undefined' && new URL(url).origin === window.location.origin;
  const enabled = !!url && !!session?.user.id;
  const query = useQuery({
    queryKey: ['link-preview', session?.user.id, url],
    enabled,
    queryFn: async ({ signal }) => {
      const preview = await resolveLinkPreview(url!, window.location.origin, signal);
      if (preview.image && !signal.aborted) {
        await preloadImage(preview.image, signal);
      }
      signal.throwIfAborted();
      return preview;
    },
    staleTime: internal ? 0 : 5 * 60_000,
    gcTime: internal ? 0 : 2 * 60_000,
    retry: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  return {
    ...query,
    data: query.isError ? undefined : query.data,
    isPending: sessionPending || (enabled && query.isPending),
  };
}
