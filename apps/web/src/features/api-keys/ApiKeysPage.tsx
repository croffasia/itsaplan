'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { qk } from '@/services/queryKeys';
import FullPageView from '@/components/common/page/FullPageView';
import { useApiKeysQuery, type ApiKeyRow } from './services/apiKeys.service';
import ApiKeysCreateSection from './components/ApiKeysCreateSection';
import ApiKeysList from './components/ApiKeysList';
import ApiKeysDeleteDialog from './components/ApiKeysDeleteDialog';

// Personal API keys for the signed-in account. Owns the key list query and the
// delete target; the child components refresh the list through the callbacks
// after a change.
export default function ApiKeysPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<ApiKeyRow | null>(null);

  const { data: apiKeys, isPending } = useApiKeysQuery();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.apiKeys });

  return (
    <FullPageView
      label="API keys"
      title="API keys"
      description={`Personal API keys authenticate requests to the API as your account (${session?.user.email}). A key's value is shown only once, when you create it.`}
    >
      <ApiKeysCreateSection onCreated={invalidate} />
      <ApiKeysList apiKeys={apiKeys ?? []} isPending={isPending} onDelete={setDeleting} />

      {deleting && (
        <ApiKeysDeleteDialog
          apiKey={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await invalidate();
          }}
        />
      )}
    </FullPageView>
  );
}
