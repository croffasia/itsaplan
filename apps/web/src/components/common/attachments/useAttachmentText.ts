import { useQuery } from '@tanstack/react-query';
import { decodeText } from '@/lib/textEncoding';

// The media route answers a non-media file with a download disposition, which a
// fetch reads all the same.
export function useAttachmentText(url: string) {
  return useQuery({
    queryKey: ['attachment-text', url],
    queryFn: async ({ signal }) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`Attachment request failed (${response.status})`);
      return decodeText(new Uint8Array(await response.arrayBuffer()));
    },
  });
}
