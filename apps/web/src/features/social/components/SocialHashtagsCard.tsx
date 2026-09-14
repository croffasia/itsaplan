import { Hash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialDashboard } from '@/lib/api';

export default function SocialHashtagsCard({
  hashtags,
}: {
  hashtags: SocialDashboard['hashtags'];
}) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Hash className="size-4 text-muted-foreground" />
          <CardTitle>Top hashtags</CardTitle>
        </div>
        <CardDescription>Most used tags in posts from this period.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {hashtags.length > 0 ? (
          hashtags.map((hashtag) => (
            <Badge key={hashtag.tag} variant="outline" className="font-normal">
              {hashtag.tag}
              <span className="text-muted-foreground">{hashtag.count}</span>
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No hashtags found in these posts.</p>
        )}
      </CardContent>
    </Card>
  );
}
