import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { GitAccountCheck } from '@/lib/api/endpoints/gitAccounts';
import Avatar from '@/components/common/Avatar';

// The account a token signs in as: its picture, name and login on the host, and a link to
// its page there. Without a picture, or when it does not load, the initials stand in.
export default function GitAccountProfile({ account }: { account: GitAccountCheck }) {
  const [failed, setFailed] = useState(false);
  const name = account.accountName ?? account.accountLogin;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
      {account.avatarUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- the host's address is not one Next's image optimizer knows.
        <img
          src={account.avatarUrl}
          alt=""
          className="size-9 shrink-0 rounded-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Avatar name={name} className="size-9 text-xs" />
      )}
      <div className="min-w-0" dir="auto">
        <a
          href={`${account.baseUrl}/${encodeURIComponent(account.accountLogin)}`}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm font-medium hover:underline"
        >
          {name}
          <ExternalLink className="ms-1 inline size-3" />
        </a>
        <div className="truncate text-xs text-muted-foreground" dir="ltr">
          @{account.accountLogin}
        </div>
      </div>
    </div>
  );
}
