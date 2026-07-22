import { type InviteView } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

// The invite summary shown at the top of the accept screen: which project, for
// which email, as which role.
export default function InviteInfo({ invite }: { invite: InviteView }) {
  const roleLabel = invite.role === 'owner' ? 'Owner' : (invite.roleName ?? 'Member');
  return (
    <div className="rounded-md border bg-muted/50 p-4 text-sm">
      <p className="text-muted-foreground">You have been invited to join</p>
      <p className="mt-0.5 flex items-center gap-2 text-base font-semibold">
        {invite.projectName}
        <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
          {roleLabel}
        </Badge>
      </p>
      <p className="mt-2 text-muted-foreground">
        Invitation for <span className="font-medium text-foreground">{invite.email}</span>
      </p>
    </div>
  );
}
