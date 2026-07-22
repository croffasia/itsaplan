'use client';

import { ItemGroup } from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import ApiKeysItem from './ApiKeysItem';
import type { ApiKeyRow } from '../services/apiKeys.service';

export default function ApiKeysList({
  apiKeys,
  isPending,
  onDelete,
}: {
  apiKeys: ApiKeyRow[];
  isPending: boolean;
  onDelete: (apiKey: ApiKeyRow) => void;
}) {
  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (apiKeys.length === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No API keys yet. Create one to authenticate requests to the API.
      </p>
    );
  }

  return (
    <ItemGroup>
      {apiKeys.map((key) => (
        <ApiKeysItem key={key.id} apiKey={key} onDelete={() => onDelete(key)} />
      ))}
    </ItemGroup>
  );
}
