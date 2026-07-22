import { useMemo, useState } from 'react';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { ToolPicker } from './ToolPicker';
import { ToolCredentialStep } from './ToolCredentialStep';

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

// Add a configured tool in two steps: pick a tool from the searchable, grouped catalog
// (ToolPicker), then pick a credential of its integration to run it on
// (ToolCredentialStep).
export function ToolConfigDialog({
  projectKey,
  catalog,
  credentials,
  onClose,
}: {
  projectKey: string;
  catalog: IntegrationMeta[];
  credentials: IntegrationCredential[];
  onClose: () => void;
}) {
  const toolOptions = useMemo<ToolOption[]>(
    () =>
      catalog
        .filter((i) => i.kind === 'tool')
        .flatMap((i) =>
          i.tools.map((t) => ({
            toolKey: t.key,
            label: t.label,
            description: t.description,
            scopes: t.scopes ?? [],
            integrationKey: i.key,
            integrationLabel: i.label,
          })),
        ),
    [catalog],
  );

  const [toolKey, setToolKey] = useState<string | null>(null);
  const tool = toolOptions.find((t) => t.toolKey === toolKey);

  return (
    <Modal title="Add tool" projectKey={projectKey} onClose={onClose} wide>
      {tool ? (
        <ToolCredentialStep
          projectKey={projectKey}
          tool={tool}
          credentials={credentials}
          onBack={() => setToolKey(null)}
          onDone={onClose}
        />
      ) : (
        <ToolPicker options={toolOptions} onSelect={setToolKey} />
      )}
    </Modal>
  );
}
