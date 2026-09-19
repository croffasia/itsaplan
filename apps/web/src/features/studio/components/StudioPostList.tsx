'use client';

import type { StudioPost } from '@/lib/api';
import StudioPostListItem from './StudioPostListItem';

export default function StudioPostList({
  posts,
  selectedId,
  onSelect,
}: {
  posts: StudioPost[];
  selectedId: string | null;
  onSelect: (postId: string) => void;
}) {
  if (posts.length === 0) {
    return <p className="text-sm text-muted-foreground">No posts yet.</p>;
  }
  return (
    <div className="space-y-1.5">
      {posts.map((post) => (
        <StudioPostListItem
          key={post.id}
          post={post}
          active={post.id === selectedId}
          onSelect={() => onSelect(post.id)}
        />
      ))}
    </div>
  );
}
