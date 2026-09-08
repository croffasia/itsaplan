'use client';

import { useState } from 'react';
import { Mail, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ApiError } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAddMember,
  useCreateInvite,
  useInvitesQuery,
  useMemberCandidatesQuery,
} from '@/services/members.service';
import { useTeamRoleOptionsQuery } from '@/services/roles.service';
import MemberPicker, { type MemberOption } from './MemberPicker';

// The message for each refusal the API can answer with; any other error falls back
// to 'refused'.
type RefusalKey = 'alreadyMember' | 'alreadyInTeam' | 'alreadyInvited' | 'refused';

const REFUSAL_KEY: Record<string, RefusalKey> = {
  ALREADY_PROJECT_MEMBER: 'alreadyMember',
  ALREADY_TEAM_MEMBER: 'alreadyInTeam',
  INVITE_ALREADY_PENDING: 'alreadyInvited',
};

// Owner is not a custom role, so it sits outside the roles list under this value.
const OWNER_VALUE = 'owner';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Adds someone to the project. A member of the team joins straight away; anyone else
// is invited by email and joins the team along with the project. Both carry the same
// role, so the dialog asks for who first and for the role second.
export default function MemberAddDialog({
  projectKey,
  projectName,
  teamId,
  teamName,
  canAdd,
  canInvite,
  canGrantOwner,
  canReadInvites,
  onClose,
}: {
  projectKey: string;
  projectName: string;
  teamId: number;
  teamName: string;
  canAdd: boolean;
  canInvite: boolean;
  // An owner bypasses the role matrix, so only a project owner or someone who runs
  // the team hands that rank out, whether by adding a member or by inviting one.
  canGrantOwner: boolean;
  // Reading the pending invites is a permission of its own: whoever may invite
  // without it goes without the "already invited" marker.
  canReadInvites: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('members.add');
  const tCommon = useTranslations('common');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<MemberOption | null>(null);
  const [roleValue, setRoleValue] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const candidatesQuery = useMemberCandidatesQuery(projectKey, canAdd);
  const rolesQuery = useTeamRoleOptionsQuery(teamId);
  const addMember = useAddMember(projectKey);
  const createInvite = useCreateInvite(projectKey);
  const invitesQuery = useInvitesQuery(projectKey, canInvite && canReadInvites);

  const candidates = candidatesQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  // Default to the team's default role until another option is picked. Empty until
  // the roles load, so a submit before that cannot fall back to Owner.
  const defaultRoleId = roles.find((r) => r.isDefault)?.id ?? roles[0]?.id;
  const role = roleValue || (defaultRoleId != null ? String(defaultRoleId) : '');

  const typed = query.trim().toLowerCase();
  // An address nobody in the team carries is offered as an invite — unless the
  // project already invited it, which cannot be done a second time.
  const pendingEmails = (invitesQuery.data ?? [])
    .filter((one) => one.status === 'pending')
    .map((one) => one.email.toLowerCase());
  const typedIsNew =
    canInvite &&
    EMAIL_PATTERN.test(typed) &&
    !candidates.some((c) => c.email.toLowerCase() === typed);
  const invite = typedIsNew ? { email: typed, pending: pendingEmails.includes(typed) } : null;
  const busy = addMember.isPending || createInvite.isPending;

  async function submit() {
    if (!target || !role) return;
    setRefusal(null);
    const input =
      role === OWNER_VALUE
        ? { role: 'owner' as const }
        : { role: 'member' as const, roleId: Number(role) };
    try {
      if (target.kind === 'member') {
        await addMember.mutateAsync({ userId: target.candidate.userId, ...input });
      } else {
        await createInvite.mutateAsync({ email: target.email, ...input });
      }
      onClose();
    } catch (error) {
      // Kept open with the reason under the picker, so another person can be chosen.
      const code = error instanceof ApiError ? (error.code ?? '') : '';
      const email = target.kind === 'invite' ? target.email : target.candidate.email;
      setRefusal(t(REFUSAL_KEY[code] ?? 'refused', { email }));
    }
  }

  return (
    <Modal
      title={t('title')}
      crumb={projectName}
      scope={
        <>
          <Users className="size-3.5" />
          {teamName}
        </>
      }
      onClose={onClose}
      wide
    >
      <div className="space-y-6 py-1">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('personLabel')}</p>
            <MemberPicker
              candidates={candidates}
              value={target}
              onChange={(option) => {
                setTarget(option);
                setRefusal(null);
              }}
              query={query}
              onQueryChange={setQuery}
              invite={invite}
              canAdd={canAdd}
              canInvite={canInvite}
              disabled={busy}
            />
            {refusal && <p className="text-xs text-destructive">{refusal}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('roleLabel')}</p>
            <Select value={role} onValueChange={setRoleValue} disabled={busy}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('rolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
                {canGrantOwner && <SelectItem value={OWNER_VALUE}>{tCommon('owner')}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        {target?.kind === 'invite' && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{target.email}</p>
              <p className="text-xs text-muted-foreground">{t('willJoinTeam', { teamName })}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t pt-5">
          <Button disabled={!target || !role || busy} onClick={submit}>
            {target?.kind === 'invite' ? t('sendInvite') : t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
