import { Eye, Heart, Instagram, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { SocialPost } from '@/lib/api';
import { compactNumber, mediaLabel, postTitle, socialDate } from '../utils/social';

export default function SocialPostCard({
  post,
  username,
}: {
  post: SocialPost;
  username: string | null;
}) {
  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardContent className="flex min-h-52 flex-col p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1 border-primary/25 text-foreground">
            <Instagram className="size-3" />
            IG
          </Badge>
          <span className="tracking-wide uppercase">{mediaLabel(post.mediaType)}</span>
          <Badge variant="secondary" className="ml-auto capitalize">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {post.status}
          </Badge>
        </div>
        <p className="mt-4 line-clamp-3 leading-snug font-medium">{postTitle(post)}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          {username ? `@${username}` : 'Instagram'}
        </p>
        <div className="mt-auto flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 text-foreground">
            <Heart className="size-3.5" /> {compactNumber(post.metrics.likes)}
          </span>
          <span className="flex items-center gap-1.5">
            <MessageCircle className="size-3.5" /> {compactNumber(post.metrics.comments)}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="size-3.5" /> {compactNumber(post.metrics.views)}
          </span>
          <span className="ml-auto">{socialDate(post.publishedAt ?? post.scheduledFor)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
