'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ChecklistDraft } from '@/lib/api/endpoints/ai-assist';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useApplyChecklist } from '@/services/aiAssist.service';

export default function AiAssistChecklistDialog({
  issueId,
  draft,
  onClose,
}: {
  issueId: number;
  draft: ChecklistDraft;
  onClose: () => void;
}) {
  const t = useTranslations('aiAssist.checklist');
  const [items, setItems] = useState(draft.items);
  const applying = useApplyChecklist(issueId);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle dir="auto">{draft.title}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
          {items.map((item, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-muted"
            >
              <span dir="auto">{item}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={t('remove')}
                onClick={() => setItems(items.filter((_, i) => i !== index))}
              >
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button
            disabled={items.length === 0 || applying.isPending}
            onClick={() => applying.mutate({ title: draft.title, items }, { onSuccess: onClose })}
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
