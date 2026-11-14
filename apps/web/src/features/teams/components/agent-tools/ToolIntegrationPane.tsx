import { useTranslations } from 'next-intl';
import { IntegrationIcon } from '@/components/common/IntegrationIcon';
import type { ToolIntegrationEntry } from '../../hooks/useAddTools';
import { toolSections } from '../../utils/toolCatalog';
import { IntegrationWebsiteLink } from '../IntegrationWebsiteLink';
import { ToolCredentialBar } from './ToolCredentialBar';
import { ToolCredentialNotice } from './ToolCredentialNotice';
import { ToolSectionList } from './ToolSectionList';
import { ToolSelectAllButton } from './ToolSelectAllButton';

// The open integration of the add-tool dialog: its tools by group, and the credential
// they are added on.
export function ToolIntegrationPane({
  entry,
  selected,
  onAddCredential,
  onToggle,
  onCredential,
}: {
  entry: ToolIntegrationEntry;
  selected: string[];
  // Left out for a member who may not add a credential.
  onAddCredential?: () => void;
  onToggle: (toolKeys: string[], on: boolean) => void;
  onCredential: (credentialId: number | null) => void;
}) {
  const t = useTranslations('teams.tools');
  const { integration, tools, added, ready } = entry;
  const total = integration.tools.length;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 sm:px-6">
        <IntegrationIcon integration={{ ...integration, kind: 'tool' }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{integration.label}</h3>
          <p className="text-xs text-muted-foreground">
            {tools.length < total
              ? t('matchCount', { shown: tools.length, total })
              : t('toolCount', { count: total })}
          </p>
        </div>
        {ready && (
          <ToolSelectAllButton
            tools={tools.filter((o) => !added.includes(o.toolKey))}
            selected={selected}
            onToggle={onToggle}
          />
        )}
        {integration.website && (
          <IntegrationWebsiteLink integration={integration.label} href={integration.website} />
        )}
      </div>
      {!ready && <ToolCredentialNotice integration={integration.label} onAdd={onAddCredential} />}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 sm:px-4">
        {toolSections(tools).map((section) => (
          <ToolSectionList
            key={section.group ?? ''}
            section={section}
            selectable={ready}
            added={added}
            selected={selected}
            onToggle={onToggle}
          />
        ))}
      </div>
      <ToolCredentialBar
        entry={entry}
        onCredential={onCredential}
        onAddCredential={onAddCredential}
      />
    </div>
  );
}
