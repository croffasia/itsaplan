'use client';

import { KeyRound, Trash2 } from 'lucide-react';
import { formatShortDate } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import type { ApiKeyRow } from '../services/apiKeys.service';

export default function ApiKeysItem({
  apiKey,
  onDelete,
}: {
  apiKey: ApiKeyRow;
  onDelete: () => void;
}) {
  return (
    <Item
      size="sm"
      className="rounded-none border-0 border-b border-border px-1 last:border-b-0 hover:bg-accent/50"
    >
      <ItemMedia>
        <KeyRound className="size-4" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{apiKey.name ?? 'API key'}</ItemTitle>
        <ItemDescription>
          {apiKey.start ? `${apiKey.start}… · ` : ''}Created {formatShortDate(apiKey.createdAt)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          title="Delete API key"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </ItemActions>
    </Item>
  );
}
