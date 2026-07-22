'use client';

import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateInvite } from '@/services/members.service';
import { useRolesQuery } from '@/services/roles.service';

// Owner is not a custom role, so it sits outside the roles list under this value.
const OWNER_VALUE = 'owner';

// The "invite someone" form: an email and a role, then create. The role options
// are the project's custom roles plus Owner. A custom role sends role=member with
// its roleId; Owner sends role=owner. A duplicate pending invite for the same
// email is a 409, toasted by the global handler. On success the form clears so
// the owner can add another.
export default function InviteCreateForm({ projectKey }: { projectKey: string }) {
  const [email, setEmail] = useState('');
  const [roleValue, setRoleValue] = useState('');
  const rolesQuery = useRolesQuery(projectKey);
  const createInvite = useCreateInvite(projectKey);

  const roles = rolesQuery.data ?? [];
  // Default to the project's default role until the owner picks another option.
  // Empty until the roles load, so a submit before that cannot fall back to Owner.
  const defaultRoleId = roles.find((r) => r.isDefault)?.id ?? roles[0]?.id;
  const selected = roleValue || (defaultRoleId != null ? String(defaultRoleId) : '');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !selected) return;
    const input =
      selected === OWNER_VALUE
        ? { email: trimmed, role: 'owner' as const }
        : { email: trimmed, role: 'member' as const, roleId: Number(selected) };
    try {
      await createInvite.mutateAsync(input);
      setEmail('');
      setRoleValue('');
    } catch {
      // The global handler toasts the reason; keep the entered email for a retry.
    }
  }

  return (
    <form onSubmit={onSubmit} className="mb-8 space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="email"
          placeholder="name@example.com"
          autoComplete="off"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={createInvite.isPending}
          className="h-9"
        />
        <Select value={selected} onValueChange={setRoleValue} disabled={createInvite.isPending}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
            <SelectItem value={OWNER_VALUE}>Owner</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          disabled={createInvite.isPending || !email.trim() || !selected}
          className="h-9 gap-1.5"
        >
          <Plus className="size-4" />
          {createInvite.isPending ? 'Inviting…' : 'Invite'}
        </Button>
      </div>
    </form>
  );
}
