import { ExternalLink, Instagram } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { SocialDashboard } from '@/lib/api';
import { compactNumber, socialDate } from '../utils/social';

export default function SocialAccountCard({ data }: { data: SocialDashboard }) {
  const account = data.account;
  return (
    <Card className="gap-5 shadow-none">
      <CardHeader className="flex grid-cols-none flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Instagram account</CardTitle>
          <CardDescription>Connection and publishing status from Zernio.</CardDescription>
        </div>
        <Badge
          variant="outline"
          className={account?.connected ? 'border-emerald-500/30 text-emerald-600' : ''}
        >
          <span
            className={`size-1.5 rounded-full ${account?.connected ? 'bg-emerald-500' : 'bg-destructive'}`}
          />
          {account?.connected ? 'Connected' : 'Action needed'}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted bg-cover bg-center"
          style={
            account?.profilePicture
              ? { backgroundImage: `url(${account.profilePicture})` }
              : undefined
          }
        >
          {!account?.profilePicture && <Instagram className="size-5 text-muted-foreground" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{account?.displayName || 'No account connected'}</p>
          <p className="truncate text-sm text-muted-foreground">
            {account?.username ? `@${account.username}` : 'Connect Instagram in Zernio'}
          </p>
        </div>
        {account?.profileUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={account.profileUrl} target="_blank" rel="noreferrer">
              {compactNumber(account.followers)} followers
              <ExternalLink />
            </a>
          </Button>
        )}
      </CardContent>
      <CardContent className="border-t pt-5 text-xs text-muted-foreground">
        Last analytics sync: {socialDate(data.syncedAt)}
      </CardContent>
    </Card>
  );
}
