'use client';

import type { StudioPost } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export default function StudioPostListItem({
  post,
  active,
  onSelect,
}: {
  post: StudioPost;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border px-3 py-2 text-left transition-colors',
        active ? 'border-primary bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{post.title}</span>
        <Badge variant={post.status === 'ready' ? 'default' : 'secondary'}>{post.status}</Badge>
      </div>
      <span className="text-xs text-muted-foreground">{post.templateName}</span>
    </button>
  );
}
