import type { SocialPost } from '@/lib/api';

export const compactNumber = (value: number) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

export const percent = (value: number) => `${value.toFixed(1)}%`;

export const socialDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : 'No date';

export function postTitle(post: SocialPost): string {
  const firstLine = post.content.trim().split('\n')[0];
  if (!firstLine)
    return post.status === 'scheduled' ? 'Scheduled Instagram post' : 'Instagram post';
  return firstLine.length > 90 ? `${firstLine.slice(0, 87)}…` : firstLine;
}

export const mediaLabel = (mediaType: string | null) =>
  mediaType?.toLowerCase().includes('video') ? 'Reel' : 'Post';

export function filterSocialPosts(
  posts: SocialPost[],
  status: 'all' | 'published' | 'scheduled',
  search: string,
) {
  const query = search.trim().toLowerCase();
  return posts.filter(
    (post) =>
      (status === 'all' || post.status === status) &&
      (!query || post.content.toLowerCase().includes(query)),
  );
}
