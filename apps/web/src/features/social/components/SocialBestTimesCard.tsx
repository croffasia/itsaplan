import { Clock3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialDashboard } from '@/lib/api';
import { compactNumber } from '../utils/social';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function SocialBestTimesCard({
  bestTimes,
}: {
  bestTimes: SocialDashboard['bestTimes'];
}) {
  return (
    <Card className="gap-4 shadow-none">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock3 className="size-4 text-muted-foreground" />
          <CardTitle>Best posting times</CardTitle>
        </div>
        <CardDescription>Based on average historical engagement. Times are UTC.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {bestTimes.length > 0 ? (
          bestTimes.map((slot) => (
            <div
              key={`${slot.day}-${slot.hour}`}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {DAYS[slot.day]} at {String(slot.hour).padStart(2, '0')}:00
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {compactNumber(slot.averageEngagement)} avg · {slot.postCount} posts
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            More published posts are needed for a recommendation.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
