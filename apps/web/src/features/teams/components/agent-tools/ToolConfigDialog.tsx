import { useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import Modal from '@/components/common/overlay/Modal';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import { Input } from '@/components/ui/input';
import { useAddTools } from '../../hooks/useAddTools';
import { CredentialDialog } from '../integrations/CredentialDialog';
import { ToolAddFooter } from './ToolAddFooter';
import { ToolIntegrationPane } from './ToolIntegrationPane';
import { ToolRailSection } from './ToolRailSection';

// Add configured tools: the integrations on one side, those the team can use now
// first, and the tools of the open one on the other. A selection may span integrations.
// Each integration's tools are added on one of its credentials, picked in the same
// view, or on none when the integration needs no credential. An integration the team
// has no credential for offers to add one, in the credential dialog opened over this one.
export function ToolConfigDialog({
  teamId,
  teamName,
  canAddCredential,
  catalog,
  onClose,
}: {
  teamId: number;
  teamName: string;
  canAddCredential: boolean;
  catalog: IntegrationMeta[];
  onClose: () => void;
}) {
  const t = useTranslations('teams.tools');
  const tools = useAddTools(teamId, catalog, onClose);
  const { active } = tools;
  const [connecting, setConnecting] = useState<string | null>(null);
  const rail = { activeKey: active?.integration.key ?? null, onOpen: tools.open };

  return (
    <Modal title={t('add')} scope={teamName} onClose={onClose} wide="xl" flush>
      <div className="flex h-[min(680px,72vh)] min-h-0 flex-col">
        <div className="relative mx-6 mb-4">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            autoComplete="off"
            value={tools.query}
            onChange={(e) => tools.setQuery(e.target.value)}
            placeholder={t('search')}
            className="ps-9"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t sm:flex-row">
          {tools.loading ? (
            <ListSkeleton rows={6} className="flex-1 p-4" />
          ) : !active ? (
            <EmptyState
              title={t('nothingFound')}
              description={t('noMatches', { query: tools.query.trim() })}
            />
          ) : (
            <>
              <nav className="max-h-40 shrink-0 overflow-y-auto border-b px-2 pb-2 sm:max-h-none sm:w-64 sm:border-e sm:border-b-0">
                <ToolRailSection
                  title={t('readyToUse')}
                  entries={tools.entries.filter((e) => e.ready)}
                  {...rail}
                />
                <ToolRailSection
                  title={t('needsCredential')}
                  entries={tools.entries.filter((e) => !e.ready)}
                  {...rail}
                />
              </nav>
              <ToolIntegrationPane
                entry={active}
                selected={tools.selected}
                onAddCredential={
                  canAddCredential ? () => setConnecting(active.integration.key) : undefined
                }
                onToggle={tools.toggle}
                onCredential={(id) => tools.setCredential(active.integration.key, id)}
              />
            </>
          )}
        </div>

        <div className="border-t px-6 py-3.5">
          <ToolAddFooter
            pending={tools.pending}
            busy={tools.busy}
            onClear={tools.clear}
            onCancel={onClose}
            onSubmit={tools.submit}
          />
        </div>
      </div>
      {connecting && (
        <CredentialDialog
          teamId={teamId}
          teamName={teamName}
          catalog={catalog}
          existing={null}
          integration={connecting}
          onClose={(created) => {
            if (created) tools.setCredential(created.integrationKey, created.id);
            setConnecting(null);
          }}
        />
      )}
    </Modal>
  );
}
