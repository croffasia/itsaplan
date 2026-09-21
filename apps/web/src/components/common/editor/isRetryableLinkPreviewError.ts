import { ApiError } from '@/lib/api/core/client';

export function isRetryableLinkPreviewError(error: unknown) {
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.name === 'TimeoutError') ||
    (error instanceof ApiError && [408, 502, 503, 504].includes(error.status))
  );
}
