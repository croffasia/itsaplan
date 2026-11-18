import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgentSection } from '../../context/agentSection';
import { useTeam } from '@/services/teams.service';
import { useTeamGitProviderConnectionsQuery } from '@/services/gitConnections.service';
import type { FormForgeIdentity } from '../../utils/agentForm';

const host = (baseUrl: string) => baseUrl.replace(/^https?:\/\//, '');

// The logins the agent opens pull requests as, each on a Git connection of the team. A
// review of a pull request one of them opened starts a run. Only a team owner or manager
// may list the connections, so anyone else picks from the hosts already set.
export function AgentForgeIdentities({
  value,
  onChange,
}: {
  value: FormForgeIdentity[];
  onChange: (value: FormForgeIdentity[]) => void;
}) {
  const t = useTranslations('teams.agents');
  const { teamId } = useAgentSection();
  const role = useTeam(teamId)?.role;
  const runsTeam = role === 'owner' || role === 'manager';
  const connections = useTeamGitProviderConnectionsQuery(runsTeam ? teamId : null).data ?? [];
  const hosts = new Map(value.map((identity) => [identity.connectionId, identity.baseUrl]));
  for (const connection of connections) hosts.set(connection.id, connection.baseUrl);
  const first = [...hosts][0];

  const update = (index: number, patch: Partial<FormForgeIdentity>) =>
    onChange(value.map((identity, i) => (i === index ? { ...identity, ...patch } : identity)));

  return (
    <div className="space-y-2 border-s ps-3">
      <span>
        <span className="text-sm">{t('forgeIdentities')}</span>
        <span className="block text-xs text-muted-foreground">
          {hosts.size > 0 ? t('forgeIdentitiesHint') : t('forgeIdentitiesNoConnections')}
        </span>
      </span>
      {value.map((identity, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            value={String(identity.connectionId)}
            onValueChange={(v) => {
              const connectionId = Number(v);
              update(index, { connectionId, baseUrl: hosts.get(connectionId) ?? '' });
            }}
          >
            <SelectTrigger className="min-w-0 flex-1" aria-label={t('forgeHost')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...hosts].map(([id, baseUrl]) => (
                <SelectItem key={id} value={String(id)} dir="ltr">
                  {host(baseUrl)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            dir="ltr"
            className="min-w-0 flex-1"
            aria-label={t('forgeLogin')}
            placeholder={t('forgeLogin')}
            value={identity.login}
            onChange={(e) => update(index, { login: e.target.value })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={t('removeForgeIdentity')}
            title={t('removeForgeIdentity')}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      {first && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...value, { connectionId: first[0], login: '', baseUrl: first[1] }])
          }
        >
          <Plus className="size-4" />
          {t('addForgeIdentity')}
        </Button>
      )}
    </div>
  );
}
