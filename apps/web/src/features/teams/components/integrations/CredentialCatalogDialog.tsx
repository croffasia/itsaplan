import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type {
  IntegrationCredential,
  IntegrationKind,
  IntegrationMeta,
} from '@/lib/api/endpoints/integrations';
import { useIntegrationOptionsQuery } from '@/services/integrations.service';
import Modal from '@/components/common/overlay/Modal';
import { EmptyState } from '@/components/common/page/EmptyState';
import { Input } from '@/components/ui/input';
import { useCredentialForm } from '../../hooks/useCredentialForm';
import { CredentialFields } from './CredentialFields';
import { CredentialFormFooter } from './CredentialFormFooter';
import { CredentialRailSection } from './CredentialRailSection';
import ShowFilterMenu from './ShowFilterMenu';

// Add a credential for any integration: the catalog on one side, grouped by kind and
// narrowed by a search and the kinds shown, and the form of the open integration on the
// other. The first match is open until another one is picked.
export function CredentialCatalogDialog({
  teamId,
  teamName,
  catalog,
  onClose,
}: {
  teamId: number;
  teamName: string;
  catalog: IntegrationMeta[];
  onClose: (created?: IntegrationCredential) => void;
}) {
  const t = useTranslations('teams.integrations');
  const [query, setQuery] = useState('');
  const [hiddenKinds, setHiddenKinds] = useState<IntegrationKind[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const options = useIntegrationOptionsQuery(teamId).data;
  const connected = useMemo(() => new Set(options?.map((o) => o.integrationKey)), [options]);

  // An integration with no credential fields (PDF) has nothing to store.
  const storable = catalog.filter((c) => c.credentialSchema.length > 0);
  const kinds = [...new Set(storable.map((c) => c.kind))];
  const q = query.trim().toLowerCase();
  const matches = storable.filter(
    (c) =>
      !hiddenKinds.includes(c.kind) &&
      (!q || c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q)),
  );
  const active = matches.find((c) => c.key === activeKey) ?? matches[0];
  const form = useCredentialForm(teamId, active, null, onClose);

  return (
    <Modal title={t('add')} scope={teamName} onClose={() => onClose()} wide="xl" flush>
      <div className="flex h-[min(680px,72vh)] min-h-0 flex-col">
        <div className="flex items-center gap-2 px-6 pb-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="ps-9"
            />
          </div>
          <ShowFilterMenu
            heading={t('showGroups')}
            options={kinds.map((kind) => ({ value: kind, label: t(`groups.${kind}.title`) }))}
            hidden={hiddenKinds}
            onChange={setHiddenKinds}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col border-t sm:flex-row">
          {!active ? (
            <EmptyState
              title={t('nothingFound')}
              description={t('noMatches', { query: query.trim() })}
            />
          ) : (
            <>
              <nav className="max-h-40 shrink-0 overflow-y-auto border-b px-2 pb-2 sm:max-h-none sm:w-64 sm:border-e sm:border-b-0">
                {kinds.map((kind) => (
                  <CredentialRailSection
                    key={kind}
                    title={t(`groups.${kind}.title`)}
                    integrations={matches.filter((c) => c.kind === kind)}
                    activeKey={active.key}
                    connected={connected}
                    onSelect={setActiveKey}
                  />
                ))}
              </nav>
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
                <CredentialFields
                  meta={active}
                  existing={null}
                  form={form}
                  connected={connected.has(active.key)}
                  className="px-4 py-5 sm:px-8 sm:py-7"
                />
              </div>
            </>
          )}
        </div>

        <div className="border-t px-6 py-3.5">
          <CredentialFormFooter form={form} onCancel={() => onClose()} />
        </div>
      </div>
    </Modal>
  );
}
