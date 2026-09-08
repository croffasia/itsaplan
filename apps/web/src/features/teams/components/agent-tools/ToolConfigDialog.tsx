import { useMemo, useState } from 'react';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import Modal from '@/components/common/overlay/Modal';
import { ToolPicker } from './ToolPicker';
import { ToolCredentialStep } from './ToolCredentialStep';
import { useTranslations } from 'next-intl';

// One catalog tool tagged with the integration it belongs to.
export interface ToolOption {
  toolKey: string;
  label: string;
  description: string;
  // OAuth scopes the credential's token must carry for this tool (may be empty).
  scopes: string[];
  integrationKey: string;
  integrationLabel: string;
}

// Add configured tools in two steps: pick one or more tools of the same integration from
// the searchable, grouped catalog (ToolPicker), then pick a credential of that
// integration to run them on (ToolCredentialStep).
export function ToolConfigDialog({
  teamId,
  teamName,
  catalog,
  onClose,
}: {
  teamId: number;
  teamName: string;
  catalog: IntegrationMeta[];
  onClose: () => void;
}) {
  const t = useTranslations('teams.tools');
  const toolOptions = useMemo<ToolOption[]>(
    () =>
      catalog
        .filter((i) => i.kind === 'tool')
        .flatMap((i) =>
          i.tools.map((tool) => ({
            toolKey: tool.key,
            label: tool.label,
            description: tool.description,
            scopes: tool.scopes ?? [],
            integrationKey: i.key,
            integrationLabel: i.label,
          })),
        ),
    [catalog],
  );

  const [tools, setTools] = useState<ToolOption[]>([]);

  return (
    <Modal title={t('add')} scope={teamName} onClose={onClose} wide>
      {tools.length > 0 ? (
        <ToolCredentialStep
          teamId={teamId}
          tools={tools}
          onBack={() => setTools([])}
          onDone={onClose}
        />
      ) : (
        <ToolPicker options={toolOptions} onSubmit={setTools} />
      )}
    </Modal>
  );
}
