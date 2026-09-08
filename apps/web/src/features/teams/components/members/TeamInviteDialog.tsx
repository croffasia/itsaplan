'use client';

import { useState, type FormEvent } from 'react';
import { Mail, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InviteTeamRole } from '@/lib/api/endpoints/invites';
import type { TeamRole } from '@/lib/api/endpoints/teams';
import { ApiError } from '@/lib/api/core/client';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateTeamInvite } from '@/services/teams.service';

// The message for each refusal the API can answer with; any other error falls back
// to 'refused'.
type RefusalKey = 'alreadyMember' | 'alreadyPending' | 'refused';

const REFUSAL_KEY: Record<string, RefusalKey> = {
  ALREADY_TEAM_MEMBER: 'alreadyMember',
  INVITE_ALREADY_PENDING: 'alreadyPending',
};

// Invites someone to the team itself: they join its member list and reach its
// projects through a membership added afterwards. Laid out like the project's own
// add-member dialog, without the project a membership needs. Only an owner grants a
// rank above member, so a manager is offered the member rank alone.
export default function TeamInviteDialog({
  teamId,
  teamName,
  teamRole,
  onClose,
}: {
  teamId: number;
  teamName: string;
  teamRole: TeamRole;
  onClose: () => void;
}) {
  const t = useTranslations('teams.invite');
  const tManage = useTranslations('teams.manage');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteTeamRole>('member');
  const [refusal, setRefusal] = useState<string | null>(null);
  const createInvite = useCreateTeamInvite(teamId);

  const ranks: InviteTeamRole[] =
    teamRole === 'owner' ? ['member', 'manager', 'owner'] : ['member'];
  const address = email.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!address) return;
    setRefusal(null);
    try {
      await createInvite.mutateAsync({ email: address, role });
      onClose();
    } catch (error) {
      // Kept open with the reason under the field, so the address can be corrected.
      const code = error instanceof ApiError ? (error.code ?? '') : '';
      setRefusal(t(REFUSAL_KEY[code] ?? 'refused', { email: address }));
    }
  }

  return (
    <Modal
      title={t('title')}
      scope={
        <>
          <Users className="size-3.5" />
          {teamName}
        </>
      }
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-6 py-1">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('emailLabel')}</p>
            <Input
              type="email"
              placeholder={t('emailPlaceholder')}
              autoComplete="off"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setRefusal(null);
              }}
              aria-invalid={refusal != null}
              disabled={createInvite.isPending}
            />
            {refusal && <p className="text-xs text-destructive">{refusal}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('roleLabel')}</p>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as InviteTeamRole)}
              disabled={createInvite.isPending || ranks.length === 1}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ranks.map((rank) => (
                  <SelectItem key={rank} value={rank}>
                    {tManage(`roles.${rank}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Mail className="size-4" />
          </span>
          <div className="min-w-0">
            {address && <p className="truncate text-sm font-medium">{address}</p>}
            <p className="text-xs text-muted-foreground">{t(`roleHint.${role}`)}</p>
          </div>
        </div>

        <div className="flex justify-end border-t pt-5">
          <Button type="submit" disabled={createInvite.isPending || !address}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
