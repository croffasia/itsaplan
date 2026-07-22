'use client';

import { KeyRound, Trash2 } from 'lucide-react';
import { formatDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { passkeyLabel } from '../../utils/authenticators';
import type { PasskeyRow } from '../../services/passkeys.service';

export default function AccountSecurityPasskeyItem({
  passkey,
  onDelete,
}: {
  passkey: PasskeyRow;
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
        <ItemTitle className="flex items-center gap-2">
          {passkeyLabel(passkey)}
          {passkey.deviceType === 'singleDevice' && (
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
              This device
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription>
          {passkey.name ? `${passkey.name} · ` : ''}Added {formatDate(passkey.createdAt)}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          title="Remove passkey"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </ItemActions>
    </Item>
  );
}
